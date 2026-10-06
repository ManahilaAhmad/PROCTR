const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proctrAPI', {
  apiBase: process.argv.find(arg => arg.startsWith('--proctr-api-base='))?.slice('--proctr-api-base='.length) || 'http://localhost:5000/api',
  setSubmissionUser: user => ipcRenderer.invoke('set-submission-user', user),
  getSubmissionBackups: () => ipcRenderer.invoke('submission-backups'),
  finishExamWork: () => ipcRenderer.invoke('finish-exam-work'),
  onSubmissionState: callback => ipcRenderer.on('submission-state', (_event, value) => callback(value)),
  onSubmissionStorageError: callback => ipcRenderer.on('submission-storage-error', (_event, value) => callback(value)),
  onSensorEvent: (callback) => ipcRenderer.on('sensor-event', (_event, value) => callback(value)),
  onCloseWarning: (callback) => ipcRenderer.on('app-close-warning', () => callback()),
  stopSensors: () => ipcRenderer.invoke('stop-sensors'),
  startExamWorkspace: (data) => ipcRenderer.invoke('start-exam-workspace', data),
  installStarterCode: (data) => ipcRenderer.invoke('install-starter-code', data),
  downloadExamPaper: (url) => ipcRenderer.invoke('download-exam-paper', url),
  openWorkspaceFolder: (path) => ipcRenderer.invoke('open-workspace-folder', path),
  setScreenProtection: (enable) => ipcRenderer.invoke('set-screen-protection', enable),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  writeLocalLog: (data) => ipcRenderer.invoke('write-local-log', data),
  submitExamWork: (data) => ipcRenderer.invoke('submit-exam-work', data),
  storeSessionToken: (token) => ipcRenderer.invoke('store-session-token', token),
  getSessionToken: () => ipcRenderer.invoke('get-session-token'),
  clearSessionToken: () => ipcRenderer.invoke('clear-session-token')
});
