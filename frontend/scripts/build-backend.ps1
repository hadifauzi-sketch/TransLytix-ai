$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$pythonExe = Join-Path $projectRoot "venv\Scripts\python.exe"
$mainPy = Join-Path $projectRoot "main.py"
$backendDir = Join-Path $projectRoot "frontend\electron\backend"
$workDir = Join-Path $projectRoot "build\pyinstaller\work"
$specDir = Join-Path $projectRoot "build\pyinstaller\spec"
$tempDist = Join-Path $projectRoot "build\pyinstaller\dist"

if (!(Test-Path $pythonExe)) {
  throw "Python venv not found at '$pythonExe'. Create venv first using run_server.bat."
}

if (!(Test-Path $mainPy)) {
  throw "Backend entrypoint not found: '$mainPy'"
}

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path $specDir | Out-Null
New-Item -ItemType Directory -Force -Path $tempDist | Out-Null

# Clean previous backend output (keep only the .db file if present)
if (Test-Path $backendDir) {
  Get-ChildItem $backendDir -Exclude "*.db" | Remove-Item -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $backendDir | Out-Null

Write-Host "[1/4] Installing PyInstaller in venv..."
& $pythonExe -m pip install pyinstaller --quiet

Write-Host "[2/4] Building one-dir backend executable..."
Write-Host "      (TensorFlow/LSTM included - this may take several minutes)"
& $pythonExe -m PyInstaller `
  --noconfirm `
  --clean `
  --onedir `
  --collect-all uvicorn `
  --collect-all fastapi `
  --collect-all starlette `
  --collect-all anyio `
  --collect-all xgboost `
  --collect-all lightgbm `
  --collect-all shap `
  --exclude-module tensorflow `
  --exclude-module keras `
  --collect-all sklearn `
  --collect-all statsmodels `
  --collect-all sqlalchemy `
  --hidden-import uvicorn `
  --hidden-import uvicorn.logging `
  --hidden-import uvicorn.loops `
  --hidden-import uvicorn.loops.auto `
  --hidden-import uvicorn.protocols `
  --hidden-import uvicorn.protocols.http `
  --hidden-import uvicorn.protocols.http.auto `
  --hidden-import uvicorn.protocols.websockets `
  --hidden-import uvicorn.protocols.websockets.auto `
  --hidden-import uvicorn.lifespan `
  --hidden-import uvicorn.lifespan.on `
  --hidden-import sqlalchemy.dialects.sqlite `
  --hidden-import sqlalchemy.sql.default_comparator `
  --hidden-import shap `
  --hidden-import shap.explainers `
  --hidden-import shap.plots `
  --hidden-import xgboost `
  --hidden-import lightgbm `
  --exclude-module namex `
  --exclude-module absl `
  --exclude-module pysqlite2 `
  --exclude-module MySQLdb `
  --exclude-module psycopg2 `
  --exclude-module torch `
  --name transformer_api `
  --distpath $tempDist `
  --workpath $workDir `
  --specpath $specDir `
  $mainPy

if ($LASTEXITCODE -ne 0) {
  throw "PyInstaller build failed with exit code $LASTEXITCODE"
}

Write-Host "[3/5] Copying build output to electron/backend..."
$sourceDir = Join-Path $tempDist "transformer_api"
if (!(Test-Path $sourceDir)) {
  throw "Expected onedir output not found at '$sourceDir'"
}
Copy-Item "$sourceDir\*" -Destination $backendDir -Recurse -Force

# Ensure VC++ runtime DLLs are present for native extensions.
Write-Host "[4/5] Ensuring VC++ runtime DLLs..."
$internalDir = Join-Path $backendDir "_internal"
$vcDlls = @("msvcp140_1.dll", "msvcp140_2.dll", "msvcp140_codecvt_ids.dll")
foreach ($dll in $vcDlls) {
  $dest = Join-Path $internalDir $dll
  if (!(Test-Path $dest)) {
    $src = Join-Path "C:\Windows\System32" $dll
    if (Test-Path $src) {
      Copy-Item $src -Destination $dest -Force
      Write-Host "      Copied $dll from System32"
    } else {
      Write-Host "      [SKIP] $dll not found in System32"
    }
  }
}

# Bundle the project database as seed data for first-run in packaged mode.
# At runtime, main.cjs copies this to AppData on first launch.
$projectDb = Join-Path $projectRoot "transformer_assets.db"
$bundledDb = Join-Path $backendDir "transformer_assets.db"
if (Test-Path $projectDb) {
  Copy-Item $projectDb -Destination $bundledDb -Force
  Write-Host "      Bundled seed database from project root"
} elseif (Test-Path $bundledDb) {
  Remove-Item $bundledDb -Force
}

Write-Host "[5/5] Backend build complete."
Write-Host "      Executable: '$backendDir\transformer_api.exe'"
Write-Host "      Size: $([math]::Round((Get-ChildItem $backendDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 0)) MB"
