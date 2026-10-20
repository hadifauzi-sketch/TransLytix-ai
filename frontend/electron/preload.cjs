const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopRuntime", {
  isElectron: true,
  platform: process.platform,
  backendBaseUrl: process.env.ELECTRON_BACKEND_URL || "",
  backendOwnedByElectron: process.env.BACKEND_OWNED_BY_ELECTRON === "1",
  getStorageInfo: () => ipcRenderer.invoke("desktop:get-storage-info"),
  openStorageDirectory: () => ipcRenderer.invoke("desktop:open-storage-directory"),
});
