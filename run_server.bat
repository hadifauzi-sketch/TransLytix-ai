@echo off
REM ============================================================
REM  Transformer DGA ML Backend - Setup & Run Script (Windows)
REM ============================================================
REM  This script sets up and runs the Python ML backend server.
REM  Run this BEFORE using the React frontend's ML features.
REM ============================================================

echo.
echo ====================================================
echo   Transformer DGA ML Backend Setup
echo ====================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    pause
    exit /b 1
)

REM Create virtual environment if not exists
if not exist "venv" (
    echo [1/4] Creating virtual environment...
    python -m venv venv
) else (
    echo [1/4] Virtual environment already exists.
)

REM Activate venv
echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [3/4] Installing dependencies (this may take a few minutes)...
venv\Scripts\python.exe -m pip install -r requirements.txt

echo.
echo [4/4] Starting ML API Server...
echo.
echo ====================================================
echo   Server running at: http://localhost:8000
echo   API Docs at:       http://localhost:8000/docs
echo   Press Ctrl+C to stop
echo ====================================================
echo.

venv\Scripts\python.exe main.py
