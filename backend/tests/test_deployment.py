"""Verify the same-origin production UI/API and protected operator controls."""
import mongomock
import pytest
from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient

import app.db as storage
from app.core import settings
from app.main import app
from app.simulation import get_simulator
from app.web import mount_frontend


def test_compiled_frontend_keeps_api_and_websocket_routes(tmp_path):
    (tmp_path / 'index.html').write_text('<html><body>MediSync dashboard</body></html>')
    (tmp_path / 'assets').mkdir()
    (tmp_path / 'assets' / 'app.js').write_text('console.log("dashboard");')
    application = FastAPI()

    @application.get('/api/health')
    def health():
        return {'status': 'ok'}

    @application.websocket('/api/v1/ws/live')
    async def live(ws: WebSocket):
        await ws.accept()
        await ws.receive_text()
        await ws.send_json({'type': 'pong'})

    mount_frontend(application, str(tmp_path))
    with TestClient(application) as client:
        assert 'MediSync dashboard' in client.get('/').text
        assert client.get('/assets/app.js').status_code == 200
        assert client.get('/api/health').json()['status'] == 'ok'
        with client.websocket_connect('/api/v1/ws/live') as ws:
            ws.send_text('ping')
            assert ws.receive_json()['type'] == 'pong'


def test_missing_frontend_build_fails_clearly(tmp_path):
    with pytest.raises(RuntimeError, match='compiled frontend index.html'):
        mount_frontend(FastAPI(), str(tmp_path))


def test_production_rejects_the_public_demo_token(monkeypatch):
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'demo_operator_token', 'medisync-demo-2024')
    with pytest.raises(RuntimeError, match='private DEMO_OPERATOR_TOKEN'):
        with TestClient(app):
            pass


def test_production_control_requires_private_operator_token(monkeypatch):
    isolated = mongomock.MongoClient()['deployment_tests']
    monkeypatch.setattr(storage, '_client', isolated.client)
    monkeypatch.setattr(storage, '_db', isolated)
    monkeypatch.setattr(storage, '_is_mock', True)
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'demo_operator_token', 'isolated-test-operator-token')
    assert not get_simulator().running
    with TestClient(app) as client:
        assert client.get('/api/health').json()['operator_auth_required'] is True
        assert client.post('/api/v1/simulation/start').status_code == 403
        assert client.post('/api/v1/simulation/start', headers={'X-Operator-Token': 'wrong'}).status_code == 403
        response = client.post('/api/v1/simulation/start', headers={'X-Operator-Token': 'isolated-test-operator-token'})
        assert response.status_code == 200
        assert response.json()['running'] is True
    assert not get_simulator().running
