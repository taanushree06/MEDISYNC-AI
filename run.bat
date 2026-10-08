@echo off
echo ===================================================================
echo             MediSync AI — Cross-Hospital Resource Rebalancer
echo                       HACK NEXUS : HN-AI-05
echo ===================================================================
echo.
echo Starting Backend (FastAPI on http://127.0.0.1:8000)...
start "MediSync Backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Starting Frontend (Vite on http://127.0.0.1:5173)...
start "MediSync Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both services launched! 
echo Frontend: http://127.0.0.1:5173
echo Backend API Docs: http://127.0.0.1:8000/docs
echo.
pause
