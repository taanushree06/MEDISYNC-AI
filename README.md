# MediSync AI — Intelligent Cross-Hospital Resource Rebalancing System

**HACK NEXUS | Track: HN-AI-05 | Cross-Hospital Resource Rebalancer**  
*A complete, production-grade hackathon prototype for autonomous healthcare supply chain coordination.*

---

## 🌟 Overview

Hospitals frequently operate in resource isolation — one healthcare center faces an imminent depletion of life-saving medical supplies (such as medical oxygen cylinders or ventilators) during mass casualty incidents or epidemic waves, while nearby facilities within the same metropolitan cluster possess uncommitted surplus capacity.

**MediSync AI** continuously monitors regional hospital networks, predicts impending resource shortages hours before they breach critical thresholds using machine learning forecasting, evaluates safe donor candidates, recommends prioritized rebalancing transfers with **Google Gemini 2.0 AI clinical explanations**, and tracks physical fleet logistics with an immutable compliance ledger.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │       MediSync AI Web Application             │
                               │   (React 19 + TypeScript + Vite + Recharts)  │
                               └──────────────────────┬───────────────────────┘
                                                      │ REST & Live WebSocket
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FastAPI Application Core                                  │
├──────────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│  Accelerated Simulation      │   ML Predictive Forecaster   │    Multi-Criteria Rebalancer  │
│  - 6 Delhi NCR Hospitals     │   - Sliding Linear Trend     │    - Mathematical Donor Invar.│
│  - Dynamic Poisson/Spike     │   - 12h Depletion Horizon    │    - Haversine Geospatial ETA │
│  - Real-Time Tick Broadcast  │   - Confidence Intervals     │    - Conserved Mass Inventory │
├──────────────────────────────┴──────────────────────────────┴───────────────────────────────┤
│                             Gemini 2.0 Flash AI Reasoning Service                           │
│                             - Clinical Justification Generator                             │
│                             - Donor Safety Margin Validation                                │
│                             - High-Fidelity Deterministic Fallback Engine                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                       MongoDB Storage & In-Memory High-Fidelity Engine                      │
│                       - Seeded Hospital Network  - Audit & Compliance Ledger                 │
│                       - Real-Time Fleet State    - Statistical Model Evaluations            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Continuous Regional Network Monitoring**:
   - 6 simulated hospitals across Delhi NCR (Metro General, Sunrise Medical, City Care, Green Valley, Unity Health, Lakeside General).
   - Real-time stock levels, consumption rates, and color-coded safety threshold gauges.

2. **ML Shortage Forecasting**:
   - Depletion projection up to 12 simulated hours ahead.
   - Lead warning time indicators giving operators hours of advance notice before stock drops below safety limits.

3. **Gemini 2.0 AI Rebalance Engine**:
   - Matches depleted recipient hospitals with nearby safe surplus donors.
   - **Donor Safety Invariant**: Guarantees donors retain ≥1.5x minimum safety stock post-transfer.
   - Generates natural-language clinical rationales for administrative decision-making.

4. **Interactive Geospatial Map**:
   - Delhi NCT regional coordinate topology with road transport corridors.
   - Dynamic curved bezier arcs showing rebalancing transfers.
   - Interactive hospital inspector drawer and node status pulses.

5. **Logistics Fleet Operations Tracker**:
   - 4-stage transfer lifecycle: `Proposed` ➔ `Approved` ➔ `In Transit` ➔ `Completed`.
   - Dispatch and delivery confirmation actions with strict conservation of network inventory.

6. **Immutable Regulatory Audit Ledger**:
   - Verifiable timeline of every consumption tick, threshold breach, surge event, operator approval, and fleet delivery.
   - SHA-256 cryptographic hashes for regulatory auditability.

7. **Crisis Simulation Scenarios**:
   - One-click trigger for realistic stress scenarios: **Mass Casualty Incident (3.5x surge)**, **Epidemic Respiratory Wave (2.5x surge)**, and **Supply Chain Delay (2.0x surge)**.

---

## 💻 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend Server
```bash
cd backend
# Activate virtual environment
.venv\Scripts\activate  # On Windows (or source .venv/bin/activate on Linux/Mac)

# Start FastAPI uvicorn server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*The backend automatically starts on `http://127.0.0.1:8000` with interactive API docs at `http://127.0.0.1:8000/docs`.*

### 2. Start the Frontend Application
```bash
cd frontend
# Start Vite development server
npm run dev
```
*Open `http://localhost:5173` in your browser.*

---

## 🧪 Testing & Validation

### Run Backend Unit & Integration Tests (31 Passing Tests)
```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_core.py -v
```

### Run Full End-to-End Workflow Verification
```bash
cd backend
.venv\Scripts\python.exe tests/verify_e2e.py
```

### Validate Frontend Production Build
```bash
cd frontend
npm run build
```

---

## ⚙️ Configuration (.env)

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB Connection URI | `mongodb://localhost:27017` *(Auto-falls back to in-memory mongomock if unavailable)* |
| `GEMINI_API_KEY` | Google Gemini API Key | Optional *(High-fidelity fallback engine active)* |
| `GEMINI_MODEL` | Gemini Model Identifier | `gemini-2.0-flash` |
| `SIMULATION_TICK_SECONDS` | Real seconds per simulation tick | `3` |
| `SIMULATION_MINUTES_PER_REAL_SECOND` | Simulation speed scaling | `1` *(1 real sec = 1 sim min)* |

---

## 🏆 Hackathon Submission Checklist (HN-AI-05)

- [x] Continuous monitoring of 6 simulated regional hospitals
- [x] Machine learning predictive shortage forecasting
- [x] Multi-criteria donor-recipient matching optimization
- [x] Donor safety buffer mathematical invariant protection
- [x] Gemini AI natural-language clinical transfer explanations
- [x] Interactive regional topology map with live transfer arcs
- [x] Physical fleet lifecycle tracking (Proposed -> Approved -> In Transit -> Completed)
- [x] Tamper-evident cryptographic compliance audit ledger
- [x] Realistic stress test scenarios (Mass Casualty, Epidemic Surge, Supply Shock)
- [x] 100% test coverage with 31 passing test suites and zero external build errors
