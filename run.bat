@echo off
title AURA — Autonomous Voice Utility & Response Agent

echo ============================================================
echo   AURA — Autonomous Voice Utility & Response Agent
echo   AMD AI Hackathon Production Build Launcher
echo ============================================================
echo.

:: Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node/npm is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/3] Checking backend Python dependencies...
python -m pip install -q -r backend/requirements.txt

echo [2/3] Launching AURA FastAPI Backend Server (Port 8008)...
start "AURA Backend Server" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8008"

echo [3/3] Launching AURA React Frontend (Port 5173)...
start "AURA Frontend Server" cmd /k "npm run dev"

echo.
echo ============================================================
echo   AURA System is starting up!
echo   - UI Application: http://localhost:5173
echo   - Backend REST API: http://localhost:8008
echo   - API Health Check: http://localhost:8008/health
echo   - AMD Hardware Info: http://localhost:8008/api/amd
echo ============================================================
echo.
