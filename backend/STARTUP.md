# Persistent local startup

Run `run.bat` from the project root. It checks port ownership and backend health, reuses a healthy instance from this workspace, and refuses to stop another app. For a deliberate alternate port, run `run.bat -BackendPort 8001`; frontend API and WebSocket traffic follow that port automatically.

MongoDB is configured by `backend/.env` regardless of the working directory. Set `MONGODB_URI` and `MONGODB_DATABASE` to your existing database. Do not commit credentials.

The portable MongoDB server lives under `backend/.runtime/`. Its persistent data is stored in `backend/.runtime/data`, outside Git. The launcher starts it only when the configured local MongoDB port is free. Keep this directory to preserve data across restarts. It is not a Windows service; run the launcher after reboot. An installed MongoDB service or remote URI can be used instead. Official ZIP setup: https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows-zip/

The backend requires real MongoDB by default. `MONGODB_ALLOW_MOCK=true` explicitly enables a temporary demo fallback; logs then say **IN-MEMORY MONGOMOCK**, and `/api/health` reports `status=degraded`, `mongodb=false`, `storage_mode=mongomock`, `persistent=false`. Real MongoDB reports `ok`, `true`, `mongodb`, `true`. Credentials are not printed in startup logs.

Logs and launched PIDs are saved under `backend/.runtime/`. Inspect listener ownership and process command lines before stopping a server. PID files are diagnostic hints and may become stale; never stop a process based on a PID file alone.

Startup and ordinary shutdown preserve inventory and history. The explicit **Reset Simulation Data** action still performs the existing destructive demo reset; startup/shutdown and verification never call it.

For a built frontend hosted outside Vite, set `VITE_API_BASE_URL` to the intended backend URL and optionally `VITE_WS_BASE_URL`. Development uses a same-origin proxy for REST and WebSocket traffic.

From `backend`, run `.venv\Scripts\python.exe -m pytest tests/test_core.py tests/test_startup.py -q`. Regression tests use isolated mongomock fixtures. The existing `verify_full_system.py` triggers a surge and transfer actions; only run it on demo data.
