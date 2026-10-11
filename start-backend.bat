@echo off
setlocal
title Ripple Backend (FastAPI - Port 8000)

REM Add local virtualenv (if present) and User Python installation to PATH
if exist "%~dp0backend\.venv\Scripts\python.exe" (
    set "PATH=%~dp0backend\.venv\Scripts;%PATH%"
)
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PATH=%~dp0.venv\Scripts;%PATH%"
)
set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"

cd /d "%~dp0backend"

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found on PATH.
    echo Please ensure Python 3.10+ is installed and added to PATH.
    pause
    exit /b 1
)

echo [Ripple Backend] Checking Python dependencies in .\backend ...
python -c "import fastapi, uvicorn, pydantic, multipart" >nul 2>&1
if errorlevel 1 (
    echo [Ripple Backend] Missing dependencies detected. Installing from requirements.txt ...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install Python dependencies from requirements.txt.
        pause
        exit /b 1
    )
) else (
    echo [Ripple Backend] Dependencies already installed ^(skipping pip install^).
)

echo.
echo [Ripple Backend] Starting FastAPI server at http://127.0.0.1:8000 ...
echo [Ripple Backend] Press Ctrl+C in this window to stop the backend server.
echo.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --http h11
if errorlevel 1 (
    echo.
    echo [ERROR] Ripple Backend server exited with an error. Check if port 8000 is already in use.
)
