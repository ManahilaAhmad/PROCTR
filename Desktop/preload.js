const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proctrAPI', {
  onSensorEvent: (callback) => ipcRenderer.on('sensor-event', (_event, value) => callback(value)),
  onCloseWarning: (callback) => ipcRenderer.on('app-close-warning', () => callback()),
  stopSensors: () => ipcRenderer.invoke('stop-sensors'),
  startExamWorkspace: (data) => ipcRenderer.invoke('start-exam-workspace', data),
  openWorkspaceFolder: (path) => ipcRenderer.invoke('open-workspace-folder', path)
});
