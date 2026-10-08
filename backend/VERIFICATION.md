# Verification — 8 October 2026

The existing project was retained. No existing database records were deleted, no reset endpoint was called, and the original port-8000 server was not stopped. Pre-existing uncommitted edits were preserved.

## Running services

* Original MediSync checkout (`MEDISYNC AI`): port 8000, listener PID 26084, Python launcher parent PID 6200. Its old health response says `mongodb=true`, but lacks the new storage-mode fields; that response cannot establish that it uses persistent MongoDB.
* Corrected checkout (`MEDISYNC AI - Copy`): port 8001, listener PID 20284. Health reports `status=ok`, `mongodb=true`, `storage_mode=mongodb`, `persistent=true`.
* Frontend: http://127.0.0.1:5173, connected to the corrected backend on 8001 for both REST and WebSocket traffic.
* Portable MongoDB Community 8.0.30: localhost:27017, PID 36984, data in `backend/.runtime/data`. It uses the official Windows ZIP distribution: https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows-zip/

Only one corrected backend instance is running. The original checkout remains running pending the user's decision about replacing it. Consolidation onto port 8000 is **not completed**.

## Results

| Check | Observed result |
| --- | --- |
| Existing backend suite | 31 passed |
| Backend suite plus startup regression tests | 37 passed, 0 failed; 66 Python/dependency deprecation warnings |
| Frontend production build | Passed; heavy views load separately, no oversized-chunk warning |
| Frontend lint | Passed without warnings |
| Diff whitespace check | Passed |
| Corrected health endpoint, direct and through frontend proxy | Passed; real persistent MongoDB reported |
| Hospitals endpoint | All six hospitals returned |
| Simulation Start/Pause/Resume | Passed through browser controls and isolated API tests; live stock readings changed |
| Predictions endpoint | Six regression forecasts, each with 13 forecast points |
| Resource recommendations | One proposed transfer of 36 cylinders from Metro General to City Care, 23.4-minute transport estimate |
| Live WebSocket | Browser LIVE badge; isolated endpoint ping/pong passed |
| Persistent reconnection | Six hospitals and collection records remained accessible after closing and reopening the real MongoDB client |
| Repeated startup | Corrected port 8001 reused without launching another backend or frontend |
| Occupied port belonging to original checkout | Startup refused with exit code 1, identified PID 26084; no process stopped |
| Phone layout | Overview and forecasting had no horizontal document overflow at the tested phone viewport |

The six hospitals retrieved were Metro General Hospital, Sunrise Medical Center, City Care Hospital, Green Valley Medical, Unity Health Institute, and Lakeside General. At the initial live verification, City Care had 82.8 cylinders, a safety stock of 28, and consumption of 12/hour; predicted shortage was 4.57 simulated hours, matching `(82.8 - 28) / 12`. Later Resume verification consumed a further six simulated minutes; the simulation was left **paused**.

The recommendation left Metro General above its safety stock and two-hour consumption reserve. The existing full-system script was not run against the original server because it triggers a surge and transfer mutations. The requested health, hospitals, simulation, shortage, and recommendation paths were verified individually instead. Live transfer approval/dispatch/completion and external Gemini API availability were not verified in this request.

## Corrections made

Persistent MongoDB is required by default; in-memory fallback requires explicit opt-in and is clearly marked degraded. Startup no longer prints connection credentials or labels mongomock as connected MongoDB. Startup and shutdown preserve hospital inventory, predictions, and transfers. Environment configuration resolves from the backend directory.

The launcher reserves the backend port before application startup, identifies occupied listeners, checks health and workspace identity, safely reuses a healthy matching backend, and refuses to terminate other processes. MongoDB runtime files, data, logs, and verification snapshots are ignored by Git.

The UI has a command-center banner, smoother view and card animations, animated network visualization, connection/error states, reduced-motion support, and responsive navigation/forecast layouts. REST and WebSocket traffic share the configured backend. The Resume control, chart field mapping, zero-hour shortage display, UTC clock interpretation, and unsupported evaluation metrics were corrected.

Run `run.bat -BackendPort 8001` to reuse the current verified setup. MongoDB is a project-local process rather than an installed Windows service; the launcher can start it again after reboot. Preserve `backend/.runtime/data`.
