"""Regression checks use private in-memory storage, never the application database."""
from unittest.mock import MagicMock

import mongomock
import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ServerSelectionTimeoutError

import app.db as storage
from app.core import Settings, settings
from app.main import app
from app.simulation import get_simulator


@pytest.fixture
def private_db(monkeypatch):
    client = mongomock.MongoClient()
    monkeypatch.setattr(storage, '_client', client)
    monkeypatch.setattr(storage, '_db', client['startup_tests'])
    monkeypatch.setattr(storage, '_is_mock', True)
    sim = get_simulator()
    assert not sim.running
    yield storage._db
    assert not sim.running


def failing_client(monkeypatch):
    client = MagicMock()
    client.admin.command.side_effect = ServerSelectionTimeoutError('test unavailable')
    monkeypatch.setattr(storage, '_client', None)
    monkeypatch.setattr(storage, '_db', None)
    monkeypatch.setattr(storage, '_is_mock', False)
    monkeypatch.setattr(storage, 'MongoClient', lambda *args, **kwargs: client)
    return client


def test_unavailable_mongodb_fails_without_silent_fallback(monkeypatch):
    client = failing_client(monkeypatch)
    monkeypatch.setattr(settings, 'mongodb_allow_mock', False)
    with pytest.raises(RuntimeError, match='Persistent MongoDB connection failed'):
        storage.get_client()
    client.close.assert_called_once()
    assert storage._client is None
    assert storage.get_storage_status()['persistent'] is False


def test_explicit_mock_is_never_reported_as_real_mongodb(monkeypatch, caplog):
    failing_client(monkeypatch)
    monkeypatch.setattr(settings, 'mongodb_allow_mock', True)
    storage.get_client()
    assert storage.get_storage_status() == {'mongodb': False, 'storage_mode': 'mongomock', 'persistent': False}
    assert 'IN-MEMORY MONGOMOCK' in caplog.text
    storage.close_connection()
    assert storage._is_mock is False


def test_real_connection_and_connection_loss_are_distinguished(monkeypatch):
    client = MagicMock()
    monkeypatch.setattr(storage, '_client', client)
    monkeypatch.setattr(storage, '_is_mock', False)
    assert storage.get_storage_status() == {'mongodb': True, 'storage_mode': 'mongodb', 'persistent': True}
    client.admin.command.side_effect = ServerSelectionTimeoutError('test disconnected')
    assert storage.get_storage_status() == {'mongodb': False, 'storage_mode': 'unavailable', 'persistent': False}


def test_settings_find_env_from_another_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    configured = Settings()
    assert configured.mongodb_database == settings.mongodb_database
    assert configured.mongodb_allow_mock is False


def test_startup_shutdown_preserve_stock_predictions_and_transfers(private_db):
    sim = get_simulator()
    sim.seed_hospitals()
    private_db.hospitals.update_one({'hospital_id': 'hosp-003'}, {'$set': {'current_stock': 57}})
    private_db.predictions.insert_one({'prediction_id': 'preserved', 'hospital_id': 'hosp-003'})
    private_db.transfers.insert_one({'transfer_id': 'preserved', 'status': 'completed'})
    with TestClient(app) as client:
        health = client.get('/api/health').json()
        assert health['status'] == 'degraded'
        assert health['mongodb'] is False
        assert health['storage_mode'] == 'mongomock'
        assert len(client.get('/api/v1/hospitals').json()) == 6
        assert private_db.hospitals.find_one({'hospital_id': 'hosp-003'})['current_stock'] == 57
        assert client.post('/api/v1/simulation/start').json()['running'] is True
        assert private_db.hospitals.find_one({'hospital_id': 'hosp-003'})['current_stock'] == 57
    assert private_db.predictions.count_documents({'prediction_id': 'preserved'}) == 1
    assert private_db.transfers.count_documents({'transfer_id': 'preserved'}) == 1
    assert private_db.hospitals.find_one({'hospital_id': 'hosp-003'})['current_stock'] == 57


def test_simulation_shortage_and_recommendations(private_db):
    with TestClient(app) as client:
        hospitals = client.get('/api/v1/hospitals').json()
        assert len(hospitals) == 6
        client.post('/api/v1/simulation/start').raise_for_status()
        assert client.post('/api/v1/simulation/pause').json()['paused'] is True
        assert client.post('/api/v1/simulation/resume').json()['paused'] is False
        predictions = client.get('/api/v1/predictions').json()
        assert len(predictions) == 6
        city = next(p for p in predictions if p['hospital_id'] == 'hosp-003')
        assert city['hours_to_shortage'] == pytest.approx(5.17, abs=.02)
        recommendations = client.post('/api/v1/recommendations/generate')
        recommendations.raise_for_status()
        assert recommendations.json()
        hospital_map = {h['hospital_id']: h for h in hospitals}
        for recommendation in recommendations.json():
            donor = hospital_map[recommendation['source_hospital_id']]
            assert recommendation['quantity'] > 0
            assert donor['current_stock'] - recommendation['quantity'] >= donor['minimum_safety_stock']
        with client.websocket_connect('/api/v1/ws/live') as ws:
            ws.send_text('ping')
            assert ws.receive_json()['type'] == 'pong'
