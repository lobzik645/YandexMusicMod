// @ts-nocheck

electron.contextBridge.exposeInMainWorld("yandexMusicMod", {
  getStorageValue: (key: string) => electron.ipcRenderer.invoke("yandexMusicMod.getStorageValue", key),
  setStorageValue: (key: string, value: any) => electron.ipcRenderer.send("yandexMusicMod.setStorageValue", key, value),
  onStorageChanged: (cb: Function) => {
    const listener = (_e, key, value) => cb(key, value);
    electron.ipcRenderer.on("yandexMusicMod.storageValueUpdated", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.storageValueUpdated", listener);
  },
  downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string, downloadId?: string) =>
    electron.ipcRenderer.invoke(
      "yandexMusicMod.downloadTrack",
      downloadInfo,
      trackMeta,
      customDownloadPath,
      downloadId,
    ),
  cancelDownload: (downloadId: string) => electron.ipcRenderer.send("yandexMusicMod.cancelDownload", downloadId),
  onDownloadProgress: (cb: Function) => {
    const listener = (_e: any, payload: any) => cb(payload);
    electron.ipcRenderer.on("yandexMusicMod.downloadProgress", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.downloadProgress", listener);
  },
  saveFileWithDialog: (options: { title?: string; defaultFileName?: string; content: string }) =>
    electron.ipcRenderer.invoke("yandexMusicMod.saveFileWithDialog", options),
  exportModSettings: () => electron.ipcRenderer.invoke("yandexMusicMod.exportModSettings"),
  importModSettings: () => electron.ipcRenderer.invoke("yandexMusicMod.importModSettings"),
  openDownloadDirectory: () => electron.ipcRenderer.send("yandexMusicMod.openDownloadDirectory"),
  selectDownloadFolder: () => electron.ipcRenderer.invoke("yandexMusicMod.selectDownloadFolder"),
  openFolder: (folderPath: string) => electron.ipcRenderer.invoke("yandexMusicMod.openFolder", folderPath),
  axios: (config: any) => electron.ipcRenderer.invoke("yandexMusicMod.axios", config),
  selectBackgroundFile: () => electron.ipcRenderer.invoke("yandexMusicMod.selectBackgroundFile"),
  // Возвращает { port: number, token: string } — токен обязателен в запросах /media
  getMediaServerPort: () => electron.ipcRenderer.invoke("yandexMusicMod.getMediaServerPort"),
  readFileAsDataUrl: (filePath: string) => electron.ipcRenderer.invoke("yandexMusicMod.readFileAsDataUrl", filePath),
  sendPlayerAction: (action: string) => electron.ipcRenderer.send("yandexMusicMod.sendPlayerAction", action),
  showOsd: (payload: any) => electron.ipcRenderer.send("yandexMusicMod.showOsd", payload),
  updateDiscordRpc: (state: any) => electron.ipcRenderer.send("yandexMusicMod.updateDiscordRpc", state),
  onPlayerAction: (cb: Function) => {
    const listener = (_e: any, action: string) => cb(action);
    electron.ipcRenderer.on("yandexMusicMod.playerAction", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.playerAction", listener);
  },
});

// Register Ctrl+Shift+I to open DevTools
try {
  if (electron.globalShortcut && electron.globalShortcut.register) {
    electron.globalShortcut.register("CommandOrControl+Shift+I", () => {
      const focusedWindow = electron.BrowserWindow?.getFocusedWindow();
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools();
      }
    });
  }
} catch (e) {}
