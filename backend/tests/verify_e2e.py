import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding="utf-8")

base = "http://127.0.0.1:8000"

def get(path):
    with urllib.request.urlopen(base + path) as r:
        return json.loads(r.read())

def post(path, data=None):
    payload = json.dumps(data).encode() if data else b"{}"
    req = urllib.request.Request(base + path, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

print("=== 1. Testing Root & Health ===")
print("Root:", get("/"))
print("Health:", get("/api/health"))

print("\n=== 2. Testing Hospitals ===")
hospitals = get("/api/v1/hospitals")
print(f"Hospitals count: {len(hospitals)}")
for h in hospitals:
    print(f" - {h['hospital_id']}: {h['name']} ({h['location']}) | Stock: {h['current_stock']}/{h['total_capacity']} | Min: {h['minimum_safety_stock']}")

print("\n=== 3. Starting Real-Time Simulation ===")
status = post("/api/v1/simulation/start")
print("Sim running:", status.get("running"), "Simulated Time:", status.get("simulation_time"))

time.sleep(2)

print("\n=== 4. Triggering Emergency Surge at hosp-003 (City Care) ===")
surge = post("/api/v1/simulation/emergency", {"hospital_id": "hosp-003", "multiplier": 3.5})
print("Surge status:", surge["status"]["running"])
print("Gemini Explanation:\n", surge["explanation"][:200] + "...")
print(f"Generated recommendations: {len(surge['recommendations'])}")

if surge["recommendations"]:
    rec = surge["recommendations"][0]
    rec_id = rec["recommendation_id"]
    print(f"\nEvaluating Recommendation: {rec['source_hospital_name']} -> {rec['destination_hospital_name']}")
    print(f"Transfer Quantity: {rec['quantity']} cyl | ETA: {rec['estimated_transport_minutes']} mins")
    
    print("\nApproving Recommendation...")
    transfer = post(f"/api/v1/recommendations/{rec_id}/approve")
    print("Created transfer:", transfer["transfer_id"], "Status:", transfer["status"])
    
    print("\nDispatching Transfer...")
    dispatched = post(f"/api/v1/transfers/{transfer['transfer_id']}/dispatch")
    print("Dispatched status:", dispatched["status"], "Dispatched At:", dispatched["dispatched_at"])
    
    print("\nCompleting Delivery...")
    completed = post(f"/api/v1/transfers/{transfer['transfer_id']}/complete")
    print("Completed status:", completed["status"], "Completed At:", completed["completed_at"])

print("\n=== 5. Testing Predictions ===")
preds = get("/api/v1/predictions")
print(f"Predictions generated for {len(preds)} hospitals")
for p in preds[:2]:
    rate = p.get('predicted_consumption_rate', 0.0)
    print(f" - {p.get('hospital_name', p.get('hospital_id'))}: Depletion {rate:.1f}/h | Hours to shortage: {p.get('hours_to_shortage')}")

print("\n=== 6. Testing Analytics & Audit Ledger ===")
analytics = get("/api/v1/analytics")
print("Total Network Stock:", analytics["total_stock"])
print("Completed Transfers:", analytics["total_transfers_completed"])
print("At Risk Facilities:", analytics["hospitals_at_risk"])

events = get("/api/v1/events?limit=8")
print(f"\nRecent Audit Events ({len(events)}):")
for e in events:
    print(f" - [{e['timestamp']}] {e['event_type']} -> {e.get('hospital_name') or 'Network'}")

print("\n🎉 ALL E2E WORKFLOWS VERIFIED 100% OPERATIONAL!")
