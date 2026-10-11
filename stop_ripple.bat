@echo off
setlocal
echo Stopping any running Ripple Backend (port 8000) and Frontend (port 5173) processes...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Terminating Backend PID %%a on port 8000...
    taskkill /F /T /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Terminating Frontend PID %%a on port 5173...
    taskkill /F /T /PID %%a >nul 2>&1
)

echo [OK] Ports 8000 and 5173 have been freed.
