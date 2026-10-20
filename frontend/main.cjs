const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8000);
const BACKEND_HEALTH_PATH = "/api/health";
const BACKEND_BOOT_TIMEOUT_MS = 60000;

const isDev = process.env.ELECTRON_DEV === "1";
const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:3000";
process.env.ELECTRON_BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}/api`;

let backendProcess = null;
let backendOwnedByElectron = false;

function log(...args) {
  if (isDev) {
    console.log("[electron]", ...args);
  }
}

function requestBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port: BACKEND_PORT,
        path: BACKEND_HEALTH_PATH,
        timeout: 2000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const healthy = await requestBackendHealth();
    if (healthy) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function getBackendLaunchConfig() {
  if (app.isPackaged) {
    const packagedBackendDir = path.join(process.resourcesPath, "backend");
    const packagedExe = path.join(packagedBackendDir, "transformer_api.exe");
    const packagedMainPy = path.join(packagedBackendDir, "main.py");

    if (fs.existsSync(packagedExe)) {
      return { command: packagedExe, args: [], cwd: packagedBackendDir, mode: "exe" };
    }

    if (fs.existsSync(packagedMainPy)) {
      return { command: "python", args: [packagedMainPy], cwd: packagedBackendDir, mode: "python" };
    }

    return null;
  }

  const projectRoot = path.resolve(__dirname, "..", "..");
  const mainPyPath = path.join(projectRoot, "main.py");
  const venvPython = path.join(projectRoot, "venv", "Scripts", "python.exe");
  const pythonCommand = fs.existsSync(venvPython) ? venvPython : "python";

  return {
    command: pythonCommand,
    args: [mainPyPath],
    cwd: projectRoot,
    mode: "python",
  };
}

async function ensureBackendRunning() {
  const alreadyHealthy = await requestBackendHealth();
  if (alreadyHealthy) {
    log("Backend already running on port", BACKEND_PORT);
    return;
  }

  const launch = getBackendLaunchConfig();
  if (!launch) {
    throw new Error("No backend launch target found in packaged resources.");
  }

  // Store the DB in the user's AppData folder so writes work in both
  // the installer (Program Files, read-only) and portable modes.
  const userDataPath = app.getPath("userData");
  const dbUrl = `sqlite:///${userDataPath.replace(/\\/g, "/")}/transformer_assets.db`;

  backendProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      DATABASE_URL: dbUrl,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  backendOwnedByElectron = true;
  process.env.BACKEND_OWNED_BY_ELECTRON = "1";

  backendProcess.stdout.on("data", (chunk) => log(`[backend:${launch.mode}]`, String(chunk).trim()));
  backendProcess.stderr.on("data", (chunk) => log(`[backend:${launch.mode}:err]`, String(chunk).trim()));
  backendProcess.on("exit", (code) => {
    log("Backend exited with code", code);
    backendProcess = null;
  });
  backendProcess.on("error", (err) => {
    log("Backend process error:", err.message);
  });

  const healthy = await waitForBackend(BACKEND_BOOT_TIMEOUT_MS);
  if (!healthy) {
    throw new Error(
      `Backend did not become healthy on http://127.0.0.1:${BACKEND_PORT}${BACKEND_HEALTH_PATH} within ${BACKEND_BOOT_TIMEOUT_MS / 1000}s.`,
    );
  }
}

function stopBackend() {
  if (!backendProcess || !backendOwnedByElectron) return;

  const pid = backendProcess.pid;
  if (!pid) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    backendProcess.kill("SIGTERM");
  }

  process.env.BACKEND_OWNED_BY_ELECTRON = "0";
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 460,
    height: 280,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0f172a",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const imgDir = isDev
    ? path.join(__dirname, "..", "public")
    : path.join(__dirname, "..", "dist");
  const imgUrl = `file://${path.join(imgDir, "deep-learning.png").replace(/\\/g, "/")}`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;color:#f8fafc;user-select:none;"><img src="${imgUrl}" width="64" height="64" style="margin-bottom:20px;opacity:0.9" onerror="this.style.display='none'"><h2 style="margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.5px;">Transformer Asset ML</h2><p style="margin:0 0 28px;font-size:13px;color:#94a3b8;">Starting analysis engine\u2026</p><div style="width:200px;height:3px;background:#1e293b;border-radius:2px;overflow:hidden;"><div id="bar" style="height:100%;width:0;background:linear-gradient(90deg,#3b82f6,#06b6d4);border-radius:2px;animation:fill 25s linear forwards;"></div></div><style>@keyframes fill{to{width:90%}}</style></body></html>`;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 930,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const isInternalDev = url.startsWith(devServerUrl);
    const isInternalFile = url.startsWith("file://");
    if (!isInternalDev && !isInternalFile) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(async () => {
  const splash = createSplashWindow();

  try {
    await ensureBackendRunning();
  } catch (err) {
    splash.destroy();
    dialog.showErrorBox(
      "Backend Startup Failed",
      `${err.message}\n\nThe app can still open, but API features may fail until backend is available.`,
    );
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    return;
  }

  splash.destroy();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
