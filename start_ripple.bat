@echo off
setlocal
cd /d "%~dp0"

echo ===============================================================
echo   Ripple -- Static Code Impact Analyzer (Windows Launcher)
echo   Project Root: %CD%
echo   Backend API:  http://127.0.0.1:8000  (Docs: /docs)
echo   Frontend UI:  http://localhost:5173
echo ===============================================================

if not exist "backend\app\main.py" (
    echo [ERROR] Could not find backend\app\main.py relative to %CD%
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] Could not find frontend\package.json relative to %CD%
    pause
    exit /b 1
)

netstat -aon | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Ripple Backend is already listening on port 8000 ^(skipping duplicate window^).
) else (
    echo Launching Ripple Backend in a new terminal window...
    start "Ripple Backend (Port 8000)" cmd /k "call "%~dp0start-backend.bat""
)

netstat -aon | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Ripple Frontend is already listening on port 5173 ^(skipping duplicate window^).
) else (
    echo Launching Ripple Frontend in a new terminal window...
    start "Ripple Frontend (Port 5173)" cmd /k "call "%~dp0start-frontend.bat""
)

echo.
echo [OK] Ripple servers are active.
echo      Open http://localhost:5173 in your browser.
echo      To stop both servers cleanly, run stop_ripple.bat or press Ctrl+C in each server window.
