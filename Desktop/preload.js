const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proctrAPI', {
  onSensorEvent: (callback) => ipcRenderer.on('sensor-event', (_event, value) => callback(value)),
  onCloseWarning: (callback) => ipcRenderer.on('app-close-warning', () => callback()),
  stopSensors: () => ipcRenderer.invoke('stop-sensors'),
  startExamWorkspace: (data) => ipcRenderer.invoke('start-exam-workspace', data),
  installStarterCode: (data) => ipcRenderer.invoke('install-starter-code', data),
  openWorkspaceFolder: (path) => ipcRenderer.invoke('open-workspace-folder', path),
  setScreenProtection: (enable) => ipcRenderer.invoke('set-screen-protection', enable),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  writeLocalLog: (data) => ipcRenderer.invoke('write-local-log', data),
  submitExamWork: (data) => ipcRenderer.invoke('submit-exam-work', data),
  storeSessionToken: (token) => ipcRenderer.invoke('store-session-token', token),
  getSessionToken: () => ipcRenderer.invoke('get-session-token'),
  clearSessionToken: () => ipcRenderer.invoke('clear-session-token')
});
