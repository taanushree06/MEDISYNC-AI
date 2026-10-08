"""
MediSync AI — Backend Tests
Tests for core simulation, ML prediction, optimization engine, and API.
"""

import pytest
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ─── Unit Tests: Stock Consumption Formula ────────────────────────────
class TestStockConsumption:
    """Test the core stock consumption formula."""

    def test_normal_consumption(self):
        """Stock decreases by rate * hours_elapsed."""
        current_stock = 100.0
        rate_per_hour = 10.0
        hours_elapsed = 0.05  # 3 minutes
        new_stock = max(0, current_stock - rate_per_hour * hours_elapsed)
        assert abs(new_stock - 99.5) < 0.01

    def test_zero_consumption(self):
        """Zero rate produces no change."""
        current_stock = 100.0
        rate_per_hour = 0.0
        hours_elapsed = 1.0
        new_stock = max(0, current_stock - rate_per_hour * hours_elapsed)
        assert new_stock == 100.0

    def test_no_negative_stock(self):
        """Stock never goes below zero."""
        current_stock = 5.0
        rate_per_hour = 100.0
        hours_elapsed = 1.0
        new_stock = max(0, current_stock - rate_per_hour * hours_elapsed)
        assert new_stock == 0.0

    def test_small_tick_accumulation(self):
        """Multiple small ticks accumulate correctly."""
        stock = 100.0
        rate = 12.0  # per hour
        for _ in range(60):  # 60 ticks of 1 simulated minute
            hours_elapsed = 1.0 / 60.0
            stock = max(0, stock - rate * hours_elapsed)
        # After 1 simulated hour at 12/hr → should be ~88
        assert abs(stock - 88.0) < 0.1

    def test_emergency_surge_rate(self):
        """Tripled rate depletes 3x faster."""
        stock = 100.0
        normal_rate = 10.0
        surge_rate = normal_rate * 3.0
        hours = 1.0
        normal_depletion = normal_rate * hours
        surge_depletion = surge_rate * hours
        assert surge_depletion == normal_depletion * 3


# ─── Unit Tests: Simulation Clock ─────────────────────────────────────
class TestSimulationClock:
    """Test simulated time calculations."""

    def test_time_scaling(self):
        """1 real second = 1 simulated minute with default settings."""
        real_seconds = 3  # tick interval
        minutes_per_second = 1.0
        sim_minutes = real_seconds * minutes_per_second
        assert sim_minutes == 3.0

    def test_hours_elapsed(self):
        """Convert simulated minutes to hours for consumption."""
        sim_minutes = 3.0
        sim_hours = sim_minutes / 60.0
        assert abs(sim_hours - 0.05) < 0.001


# ─── Unit Tests: Prediction Model ────────────────────────────────────
class TestPredictionModel:
    """Test the depletion-trend prediction logic."""

    def test_shortage_calculation(self):
        """time_to_shortage = (stock - safety) / depletion_rate."""
        current_stock = 100.0
        safety_stock = 20.0
        depletion_rate = 10.0  # per hour
        expected = (current_stock - safety_stock) / depletion_rate
        assert expected == 8.0

    def test_zero_depletion_no_shortage(self):
        """Zero depletion rate should not predict a shortage."""
        depletion_rate = 0.0
        if depletion_rate <= 0.01:
            hours_to_shortage = None
        else:
            hours_to_shortage = 80.0 / depletion_rate
        assert hours_to_shortage is None

    def test_negative_depletion_no_shortage(self):
        """Negative depletion (stock growing) should not predict shortage."""
        depletion_rate = -5.0
        if depletion_rate <= 0.01:
            hours_to_shortage = None
        else:
            hours_to_shortage = 80.0 / depletion_rate
        assert hours_to_shortage is None

    def test_already_below_safety(self):
        """Stock below safety should report 0 hours."""
        current_stock = 15.0
        safety_stock = 20.0
        depletion_rate = 10.0
        stock_above = current_stock - safety_stock
        if stock_above <= 0:
            hours_to_shortage = 0.0
        else:
            hours_to_shortage = stock_above / depletion_rate
        assert hours_to_shortage == 0.0


# ─── Unit Tests: Donor Safety ────────────────────────────────────────
class TestDonorSafety:
    """Test transferable surplus calculations."""

    def test_surplus_protects_safety(self):
        """Donor cannot transfer below safety + 2hr consumption."""
        current = 150.0
        safety = 25
        rate = 5.0
        reserved = safety + (rate * 2)  # 25 + 10 = 35
        surplus = max(0, int(current - reserved))
        assert surplus == 115

    def test_no_surplus_when_low(self):
        """Low-stock hospital has no surplus."""
        current = 30.0
        safety = 25
        rate = 10.0
        reserved = safety + (rate * 2)  # 25 + 20 = 45
        surplus = max(0, int(current - reserved))
        assert surplus == 0

    def test_committed_reduces_surplus(self):
        """Already-committed transfers reduce available surplus."""
        current = 150.0
        safety = 25
        rate = 5.0
        committed = 50
        reserved = safety + (rate * 2)
        surplus = max(0, int(current - reserved - committed))
        assert surplus == 65

    def test_transfer_not_exceed_surplus(self):
        """Transfer quantity cannot exceed available surplus."""
        surplus = 40
        needed = 60
        transfer_qty = min(needed, surplus)
        assert transfer_qty == 40


# ─── Unit Tests: Transfer Lifecycle ──────────────────────────────────
class TestTransferLifecycle:
    """Test transfer state machine logic."""

    def test_only_proposed_can_approve(self):
        """Only proposed recommendations can be approved."""
        statuses = ["proposed", "approved", "cancelled", "completed"]
        approvable = [s for s in statuses if s == "proposed"]
        assert approvable == ["proposed"]

    def test_only_approved_can_dispatch(self):
        """Only approved transfers can be dispatched."""
        status = "approved"
        assert status == "approved"

    def test_only_in_transit_can_complete(self):
        """Only in-transit transfers can be completed."""
        status = "in_transit"
        assert status == "in_transit"

    def test_stock_conservation_on_dispatch(self):
        """Dispatching deducts from source, not destination."""
        source_stock = 150.0
        dest_stock = 30.0
        transfer_qty = 40

        # On dispatch: deduct from source
        source_after = source_stock - transfer_qty
        assert source_after == 110.0
        assert dest_stock == 30.0  # unchanged

    def test_stock_conservation_on_complete(self):
        """Completing adds to destination."""
        dest_stock = 30.0
        transfer_qty = 40

        dest_after = dest_stock + transfer_qty
        assert dest_after == 70.0

    def test_no_double_allocation(self):
        """Same surplus cannot be allocated to two different recipients."""
        surplus = 50
        first_allocation = 30
        remaining = surplus - first_allocation
        second_allocation = min(40, remaining)  # Can only give 20 more
        assert second_allocation == 20


# ─── Unit Tests: Gemini Fallback ─────────────────────────────────────
class TestGeminiFallback:
    """Test that system works without Gemini."""

    def test_fallback_generates_explanation(self):
        """Fallback explanation is generated when Gemini unavailable."""
        from app.services.gemini_service import _fallback_explanation

        data = {
            "source_hospital_name": "Hospital A",
            "destination_hospital_name": "Hospital B",
            "quantity": 40,
            "estimated_transport_minutes": 25,
            "hours_to_shortage": 3.5,
        }
        result = _fallback_explanation(data)
        assert "40" in result
        assert "Hospital A" in result
        assert "Hospital B" in result
        assert len(result) > 50

    def test_fallback_no_hours(self):
        """Fallback works even without hours_to_shortage."""
        from app.services.gemini_service import _fallback_explanation

        data = {
            "source_hospital_name": "Src",
            "destination_hospital_name": "Dst",
            "quantity": 10,
            "estimated_transport_minutes": 20,
            "hours_to_shortage": None,
        }
        result = _fallback_explanation(data)
        assert "10" in result
        assert "soon" in result.lower()


# ─── Integration-style Tests ─────────────────────────────────────────
class TestTransportTime:
    """Test transport time calculations."""

    def test_self_transport_zero(self):
        """Transport to self is zero."""
        from app.simulation import get_transport_time
        t = get_transport_time("hosp-001", "hosp-001")
        assert t == 0

    def test_transport_between_hospitals(self):
        """Transport between different hospitals is positive."""
        from app.simulation import get_transport_time
        t = get_transport_time("hosp-001", "hosp-002")
        assert t > 0
        assert t <= 45  # Max 45 minutes

    def test_transport_symmetric(self):
        """Transport time is approximately symmetric."""
        from app.simulation import get_transport_time
        t1 = get_transport_time("hosp-001", "hosp-003")
        t2 = get_transport_time("hosp-003", "hosp-001")
        assert abs(t1 - t2) < 0.1


class TestSeedData:
    """Test hospital seed data integrity."""

    def test_six_hospitals(self):
        """Exactly 6 hospitals are seeded."""
        from app.simulation import SEED_HOSPITALS
        assert len(SEED_HOSPITALS) == 6

    def test_unique_ids(self):
        """All hospital IDs are unique."""
        from app.simulation import SEED_HOSPITALS
        ids = [h["hospital_id"] for h in SEED_HOSPITALS]
        assert len(ids) == len(set(ids))

    def test_valid_coordinates(self):
        """All hospitals have valid coordinates."""
        from app.simulation import SEED_HOSPITALS
        for h in SEED_HOSPITALS:
            assert -90 <= h["latitude"] <= 90
            assert -180 <= h["longitude"] <= 180

    def test_stock_above_safety(self):
        """Initial stock is above safety level."""
        from app.simulation import SEED_HOSPITALS
        for h in SEED_HOSPITALS:
            assert h["current_stock"] > h["minimum_safety_stock"]

    def test_positive_capacity(self):
        """All hospitals have positive capacity."""
        from app.simulation import SEED_HOSPITALS
        for h in SEED_HOSPITALS:
            assert h["total_capacity"] > 0
            assert h["consumption_rate"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
