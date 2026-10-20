#!/bin/bash
# ============================================================
#  Transformer DGA ML Backend - Setup & Run Script (Linux/Mac)
# ============================================================

echo ""
echo "===================================================="
echo "  Transformer DGA ML Backend Setup"
echo "===================================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 not found! Install Python 3.10+"
    exit 1
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "[1/4] Creating virtual environment..."
    python3 -m venv venv
else
    echo "[1/4] Virtual environment already exists."
fi

# Activate
echo "[2/4] Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "[3/4] Installing dependencies..."
venv/bin/python -m pip install -r requirements.txt

echo ""
echo "[4/4] Starting ML API Server..."
echo ""
echo "===================================================="
echo "  Server running at: http://localhost:8000"
echo "  API Docs at:       http://localhost:8000/docs"
echo "  Press Ctrl+C to stop"
echo "===================================================="
echo ""

venv/bin/python main.py
