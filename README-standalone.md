# ⚡ Transformer Asset Management + ML Analytics

## TNB Research — DGA Pattern Analysis & Fault Prediction

A full-stack system for managing power transformer assets and predicting faults
using dissolved gas analysis (DGA) with machine learning.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│           REACT FRONTEND (Vite + React 18)           │
│              http://localhost:3000                    │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Dashboard │ │Transformer│ │DGA Results│            │
│  │Overview  │ │Registry   │ │Entry     │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Rule-Based│ │ Trend    │ │ML Cluster │            │
│  │Diagnostics│ │ Charts   │ │(PCA+KMeans│            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐                          │
│  │ ARIMA /  │ │ Anomaly  │                          │
│  │LSTM Pred │ │ Detection│                          │
│  └──────────┘ └──────────┘                          │
│       │                                              │
│       │  HTTP POST via Vite proxy → /api/*           │
│       ▼                                              │
├─────────────────────────────────────────────────────┤
│           PYTHON ML BACKEND (FastAPI)                │
│              http://localhost:8000                    │
│                                                      │
│  ┌────────────────┐  ┌────────────────────┐         │
│  │ ARIMA Engine   │  │ LSTM Engine         │         │
│  │ (statsmodels)  │  │ (TensorFlow/Keras)  │         │
│  └────────────────┘  └────────────────────┘         │
│  ┌────────────────┐  ┌────────────────────┐         │
│  │ K-Means + PCA  │  │ Isolation Forest   │         │
│  │ (scikit-learn) │  │ Anomaly Detection  │         │
│  └────────────────┘  └────────────────────┘         │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Features

### Frontend (React + Vite)
- **Dashboard**: Fleet overview, condition pie chart, voltage distribution, alerts
- **Transformer Registry**: CRUD with brand, maker, voltage, MVA, site, dates
- **DGA Results Entry**: All 7 standard gases with color-coded IEEE C57.104 status
- **Diagnostics**: IEEE C57.104, Duval Triangle, Rogers Ratio, Key Gas Method
- **Trend Charts**: Historical gas trends with Recharts
- **ML Clustering**: Backend scikit-learn K-Means + PCA (JS fallback)
- **ML Predictions**: ARIMA / LSTM / Linear with confidence intervals
- **Anomaly Detection**: Isolation Forest flags abnormal DGA records

### Backend (Python FastAPI)
- **ARIMA Forecast**: Auto-tuned (p,d,q) with 95% confidence intervals
- **LSTM Forecast**: 2-layer neural network with dropout regularization
- **K-Means + PCA**: StandardScaler normalized, 2D PCA visualization
- **Anomaly Detection**: Isolation Forest with configurable contamination
- **Risk Assessment**: Automatic IEEE limit crossing warnings

---

## 🚀 Quick Start

### Step 1: Start the Python ML Backend

```bash
# From the project root

# Option A: Windows
run_server.bat

# Option B: Linux/Mac
chmod +x run_server.sh
./run_server.sh

# Option C: Manual setup
python -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\activate.bat      # Windows
pip install -r requirements.txt
python main.py
```

Backend starts at **http://localhost:8000** with interactive API docs at `/docs`.

### Step 2: Start the React Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at **http://localhost:3000** and proxies `/api/*` to the backend.

### Step 3: Open http://localhost:3000

The frontend auto-detects the Python backend and shows a status indicator in the header.
ARIMA/LSTM model buttons are enabled when the backend is live.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check + ML capability status |
| POST | `/api/predict/arima` | ARIMA time-series forecast |
| POST | `/api/predict/lstm` | LSTM neural network forecast |
| POST | `/api/cluster` | K-Means clustering with PCA |
| POST | `/api/anomaly` | Isolation Forest anomaly detection |

Full interactive docs at **http://localhost:8000/docs** when backend is running.

---

## 🔬 ML Model Details

| Model | When to Use | Min Data | Strengths |
|-------|-------------|----------|-----------|
| ARIMA | Linear trends, regular sampling | 3 pts (5+ recommended) | Statistical CIs, interpretable |
| LSTM | Non-linear patterns | 3 pts (auto-interpolates) | Captures complex patterns |
| Linear (JS) | Quick estimate, no backend | 2 pts | Instant, no server needed |

---

## 📁 Project Structure

```
files/
├── main.py                 # Python FastAPI server + ML models
├── requirements.txt        # Python dependencies
├── run_server.bat          # Windows backend start script
├── run_server.sh           # Linux/Mac backend start script
├── README.md               # This file
└── frontend/
    ├── package.json        # React + Vite dependencies
    ├── vite.config.js      # Vite config with API proxy
    ├── index.html          # Entry HTML
    └── src/
        ├── main.jsx        # React entry point
        ├── App.jsx         # App wrapper
        ├── services/
        │   └── api.js      # API service layer
        └── components/
            └── TransformerAssetML.jsx  # Main React component
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend offline indicator | Start Python: `python main.py` |
| TensorFlow install fails | `pip install tensorflow-cpu` for smaller install |
| CORS errors | Vite proxy handles `/api` in dev; backend has CORS `*` |
| LSTM too slow | Use ARIMA or reduce forecast months |
| Port 8000 in use | Change in `main.py`: `uvicorn.run(app, port=8001)` |
| npm install fails | Ensure Node.js 18+ installed |

---

## SQLite Persistence

- Local DB file: `transformer_assets.db` (auto-created in project root).
- In packaged Electron builds, the DB is copied to the Electron user-data folder and stays writable there.
- New storage endpoints:
  - `GET /api/storage`
  - `POST /api/storage/bootstrap`
  - `POST/PUT/DELETE /api/transformers`
  - `POST/PUT/DELETE /api/results`
- Reset local data: stop backend, then delete `transformer_assets.db`.

---

## Electron (Windows Desktop)

The frontend now includes Electron setup with automatic Python backend startup.

### 1. Install frontend desktop dependencies

```bash
npm run frontend:install
```

You can still run the same command manually inside `frontend/` if you prefer.

### 2. Run desktop app in development mode

```bash
npm run electron:dev
```

What this does:
- starts Vite dev server on `http://127.0.0.1:3000`
- launches Electron
- Electron starts backend (`../venv/Scripts/python.exe ../main.py`) if not already running

### 3. Build backend EXE (optional but recommended for distribution)

```bash
npm run electron:build:backend
```

This generates:
- `frontend/electron/backend/transformer_api.exe`

### 4. Build Windows installer

```bash
npm run electron:dist
```

Installer output:
- `frontend/release/`

### Notes

- If backend EXE is not bundled, packaged app falls back to `python` from PATH and runs bundled `main.py`.
- For best portability to other Windows machines, use `electron:build:backend` before packaging.
- In Electron mode, transformer add/edit/delete changes are stored in SQLite automatically.
- The dashboard now shows the active desktop database path and lets you open the DB folder directly.
