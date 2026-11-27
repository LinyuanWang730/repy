const { contextBridge, ipcRenderer } = require("electron");

/**
 * 渲染层唯一能碰到的主进程能力。
 * 全部走 IPC，不开放 node 环境。
 */
contextBridge.exposeInMainWorld("desktop", {
  info: () => ipcRenderer.invoke("app:info"),
  copy: text => ipcRenderer.invoke("app:copy", text),
  openDataDir: () => ipcRenderer.invoke("app:openDataDir"),
  openSite: url => ipcRenderer.invoke("app:openSite", url),
  pickInstaller: () => ipcRenderer.invoke("app:pickInstaller"),
  checkUpdate: () => ipcRenderer.invoke("app:checkUpdate"),
  syncSnapshot: payload => ipcRenderer.send("data:snapshot", payload),
  saveLog: payload => ipcRenderer.invoke("app:saveLog", payload),
  shareSetup: payload => ipcRenderer.invoke("app:shareSetup", payload),
  uninstallInfo: () => ipcRenderer.invoke("app:uninstallInfo"),
  uninstall: () => ipcRenderer.invoke("app:uninstall")
});
