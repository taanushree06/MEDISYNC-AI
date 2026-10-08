@echo off
echo ===================================================================
echo             MediSync AI — Automated Test Suite Runner
echo ===================================================================
echo.
cd /d "%~dp0backend"
echo [1/2] Running Pytest Unit and Integration Suite...
.venv\Scripts\python.exe -m pytest tests/test_core.py -v
if %ERRORLEVEL% NEQ 0 (
    echo Pytest failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Running Full End-to-End Workflow Verification...
.venv\Scripts\python.exe tests/verify_e2e.py
if %ERRORLEVEL% NEQ 0 (
    echo E2E verification failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================================
echo             ALL MEDISYNC AI TESTS PASSED SUCCESSFULLY!
echo ===================================================================
pause
