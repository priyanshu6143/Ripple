@echo off
setlocal
title Ripple Frontend (Vite - Port 5173)

REM Ensure User Node.js installation is on PATH and prevent Vite from closing on non-TTY stdin
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
set "CI=true"

cd /d "%~dp0frontend"

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH.
    echo Please ensure Node.js 18+ is installed and added to PATH.
    pause
    exit /b 1
)

echo [Ripple Frontend] Checking frontend packages in .\frontend ...
if not exist "node_modules\.bin\vite.cmd" (
    echo [Ripple Frontend] node_modules not found or incomplete. Running npm install ...
    call npm.cmd install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend npm packages.
        pause
        exit /b 1
    )
) else (
    echo [Ripple Frontend] node_modules already present ^(skipping npm install^).
)

echo.
echo [Ripple Frontend] Starting Vite dev server at http://localhost:5173 ...
echo [Ripple Frontend] Press Ctrl+C in this window to stop the frontend server.
echo.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
if errorlevel 1 (
    echo.
    echo [ERROR] Ripple Frontend server exited with an error. Check if port 5173 is already in use.
)
