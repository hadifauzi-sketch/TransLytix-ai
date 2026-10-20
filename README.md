# TransLytix AI

Python transformer oil ML backend, original React frontend source, and an ELIMS
integration example for `hadifauzi-sketch/lubelytic-lims`.

This is source code, not a deployed service. No real transformer database,
customer data, saved models, installed dependencies, or desktop binaries are included.

## 1. Run the prediction API

Use Python 3.12 (the Vercel configuration pins 3.12). In PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:AI_API_TOKEN = 'set-a-long-random-secret'
python -m uvicorn api_app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs. Use `X-AI-Token` for API requests.
Environment variables are read from the process; `.env.example` is a template,
and no dotenv loader is required. An unset token makes API requests fail closed.

Default dependencies enable ARIMA, NumPy LSTM, Random Forest, K-Means/PCA and
Isolation Forest. To add XGBoost, LightGBM and SHAP:

```powershell
python -m pip install -r requirements-optional.txt
```

TensorFlow is optional and installed separately. The included NumPy LSTM is a
fallback implementation; it is not a bundled pretrained TensorFlow model.
Some forecast endpoints fit models per request and may use a linear fallback;
inspect response diagnostics and benchmark runtime with your actual histories.

## 2. Deploy Python to Vercel

Import this repository as a **separate project** from ELIMS. Use repository root
as Root Directory and FastAPI framework detection. Clear inherited Vite build
commands/output-directory overrides if present. `pyproject.toml` selects
`api_app:app`; `requirements.txt` supplies the Python dependencies. Configure
`AI_API_TOKEN` as a Vercel server environment variable, then deploy.

`vercel.json` sets a 300-second function duration. Dependency size, memory and
training time still need validation on the selected plan. Optional dependencies
must be added to `requirements.txt` if you want Vercel to install them.
See https://vercel.com/docs/frameworks/backend/fastapi and
https://vercel.com/docs/functions/limitations.

The deployment exposes prediction, clustering, anomaly and capability routes.
It excludes the original app's storage/account/assessment-history API. A disposable
empty SQLite database supports legacy imports; it is not persistent storage.
Cross-transformer training from the standalone database has no fleet data here:
forecasts use submitted history. Existing GET `/api/ai/*` assessment screens need
a separate authorized Supabase adapter and are not exposed by this entry point.

## 3. Connect ELIMS

Copy these files into the ELIMS repository:

| This repository | ELIMS destination |
| --- | --- |
| `integration/elims/api/ai-predict.js` | `api/ai-predict.js` |
| `integration/elims/predict.js` | `src/services/aiPrediction.js` |

In the ELIMS Vercel project set **server-only** environment variables:

```text
AI_API_URL=https://your-python-project.vercel.app
AI_API_TOKEN=the-same-secret-as-the-python-project
SUPABASE_URL=your-existing-elims-supabase-url
SUPABASE_ANON_KEY=your-existing-elims-publishable-or-anon-key
```

Do not prefix the shared secret with `VITE_` or `REACT_APP_`. Do not use a
Supabase service-role key. The proxy validates the caller's Supabase session,
queries history with that caller's JWT, and relies on existing database RLS.
Verify the view/table policies enforce your intended company and asset access.

Your current ELIMS `vercel.json` rewrites every URL to `index.html`. Replace
its `rewrites` with the following and add the function setting at top level:

```json
{
  "functions": { "api/ai-predict.js": { "maxDuration": 300 } },
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Keep the existing framework, install/build commands and `outputDirectory`.
The example excludes API paths from SPA fallback; verify routing in a Vercel
preview before production deployment.

Call from your TransLytix AI page after selecting a transformer:

```js
import { predictTransformer } from 'services/aiPrediction';

const result = await predictTransformer(selectedTransformerId, {
  model: 'arima',
  forecastMonths: 12,
  gases: ['H2', 'CH4', 'C2H2'],
});
// Display result.forecasts, result.overall_risk and result.recommendation.
```

This is an integration example, not a completed ELIMS page. Confirm metadata
column mappings against your database. It reads up to the latest 1000 records
from `tx_oil_tests`, checks access through `tx_asset_transformers`, sorts history
oldest first and skips records missing selected gas readings. Values are sent
in the stored units; verify gas units and reporting-limit treatment before use.

## 4. Original standalone application

`main.py`, `ai_engine/` and `frontend/` retain the current standalone source for
reference or copying components. The original app has a separate local database
and login system. Its account routes are not an ELIMS authorization mechanism.
Set `BOOTSTRAP_ADMIN_PASSWORD` before starting a fresh local database; a fixed
default password is no longer shipped. See `README-standalone.md` for UI details.

```powershell
python main.py
# In another terminal at this repository root:
npm run frontend:install
npm run frontend:dev
```

The standalone frontend uses Vite's `/api` proxy to local port 8000. It targets
`main.py`, not the restricted `api_app.py`. Plotly is regenerated by the existing
prebuild/predev script. Large OCR assets are excluded and OCR uses Tesseract's
CDN defaults, requiring internet access. Desktop binaries must be built locally.

## Excluded files

Virtual environments, node_modules, build/release directories, executable files,
SQLite databases/backups, logs, datasets, archives, model binaries, generated
Plotly and OCR assets are excluded. All copied source files are under 1 MiB.
