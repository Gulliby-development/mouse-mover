const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mouseMover', {
  getState: () => ipcRenderer.invoke('mouse-mover:get-state'),
  getHotkeyStatus: () => ipcRenderer.invoke('mouse-mover:get-hotkey-status'),
  toggle: () => ipcRenderer.invoke('mouse-mover:toggle'),
  onStateChanged: callback => {
    ipcRenderer.on('state-changed', (_event, state) => callback(state));
  },
  onHotkeyError: callback => {
    ipcRenderer.on('hotkey-error', (_event, message) => callback(message));
  },
  onMovementError: callback => {
    ipcRenderer.on('movement-error', (_event, message) => callback(message));
  }
});
