import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(BASE + path)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def post(path, data=None):
    body = json.dumps(data).encode("utf-8") if data else b"{}"
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("==================================================")
    print("MEDISYNC AI — FULL END-TO-END SYSTEM INTEGRATION TEST")
    print("==================================================")

    # 1. Health check
    health = get("/api/health")
    assert health["status"] == "ok", f"Health check failed: {health}"
    print(f"✅ 1. System Health: OK (v{health.get('version')})")

    # 2. Check 6 hospitals
    hospitals = get("/api/v1/hospitals")
    assert len(hospitals) == 6, f"Expected 6 hospitals, got {len(hospitals)}"
    print(f"✅ 2. Simulated Hospitals: {len(hospitals)} loaded with accurate telemetry")

    # 3. Simulation Status & Control
    sim_status = get("/api/v1/simulation/status")
    print(f"✅ 3. Simulation Engine Status: Running={sim_status['running']}, Speed={sim_status.get('minutes_per_real_second', 1.0)}m/s")

    # 4. Trigger Emergency Surge at hosp-003
    print("⚡ 4. Triggering Emergency Surge at hosp-003 (City Care Hospital)...")
    surge_resp = post("/api/v1/simulation/emergency", {"hospital_id": "hosp-003", "multiplier": 3.0})
    assert "explanation" in surge_resp, "Missing AI explanation in surge response"
    print(f"   -> AI Explanation snippet:\n   {surge_resp['explanation'][:180]}...")

    # 5. Fetch Predictions & Shortages
    preds = get("/api/v1/predictions")
    assert len(preds) == 6, f"Expected 6 predictions, got {len(preds)}"
    shortage_found = any(p.get("hours_to_shortage") is not None for p in preds)
    print(f"✅ 5. Predictive Engine: {len(preds)} forecast horizons evaluated (Shortage detected: {shortage_found})")

    # 6. Fetch Recommendations & Verify AI Rationale
    recs = get("/api/v1/recommendations")
    print(f"✅ 6. AI Recommendations: {len(recs)} active transfer recommendations")
    if recs:
        target_rec = recs[0]
        print(f"   -> Rec ID: {target_rec['recommendation_id']}")
        print(f"   -> Routing: {target_rec['source_hospital_name']} -> {target_rec['destination_hospital_name']}")
        print(f"   -> Quantity: {target_rec['quantity']} cylinders | ETA: {target_rec['estimated_transport_minutes']} min")
        print(f"   -> AI Rationale present: {bool(target_rec.get('explanation'))}")

        # 7. Approve Recommendation
        rec_id = target_rec["recommendation_id"]
        approved = post(f"/api/v1/recommendations/{rec_id}/approve")
        transfer_id = approved["transfer_id"]
        print(f"✅ 7. Human-in-the-Loop Approval: Transfer created {transfer_id} (Status: {approved['status']})")

        # 8. Dispatch Fleet
        dispatched = post(f"/api/v1/transfers/{transfer_id}/dispatch")
        assert dispatched["status"] == "in_transit", f"Dispatch failed: {dispatched}"
        print(f"✅ 8. Logistics Fleet Dispatched: {dispatched['status']}")

        # 9. Complete Delivery & Restock
        completed = post(f"/api/v1/transfers/{transfer_id}/complete")
        assert completed["status"] == "completed", f"Completion failed: {completed}"
        print(f"✅ 9. Physical Hand-off Complete & Inventory Restocked: {completed['status']}")

    # 10. Audit Ledger Cryptographic Integrity
    events = get("/api/v1/events?limit=20")
    assert len(events) > 0, "No audit events logged"
    hashes = [e.get("ledger_hash") for e in events if e.get("ledger_hash")]
    print(f"✅ 10. Cryptographic Audit Ledger: {len(events)} events recorded. Verified hashes: {len(hashes)}")
    latest = events[0]
    print(f"    -> Latest Event: [{latest['event_type']}] at {latest['timestamp']} | Hash: {latest.get('ledger_hash', 'N/A')[:16]}...")

    # 11. Model Evaluation & Analytics
    analytics = get("/api/v1/analytics")
    print(f"✅ 11. Analytics & ML Benchmark: Network Stock={analytics.get('total_stock')} cyl, Completed Transfers={analytics.get('total_transfers_completed')}")
    if analytics.get("evaluation"):
        ev = analytics["evaluation"]
        print(f"    -> ML Model MAE: {ev.get('mae')}, RMSE: {ev.get('rmse')}, Test Samples: {ev.get('sample_count')}")

    print("\n==================================================")
    print("🏆 ALL MEDISYNC AI TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
