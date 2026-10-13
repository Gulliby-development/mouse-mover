const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');

const { createGlobalHotkey } = require('./global-hotkey');
const { readSpeed } = require('./settings');
const { MouseMover } = require('./mouse-mover');
const { createWindowsCursor } = require('./windows-cursor');

let mainWindow;
let mouseMover;
let cursorController;
let nativeHotkey;
let hotkeyError;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 340,
    useContentSize: true,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMouseMover() {
  const { speedPxPerSecond, warning } = readSpeed(process.env);
  if (warning !== null) {
    console.warn(warning);
  }

  cursorController = createWindowsCursor();

  return new MouseMover({
    cursor: cursorController,
    getScreenBounds: () => cursorController.getScreenBounds(),
    onStateChanged: sendStateToRenderer,
    onError: sendMovementError,
    speedPxPerSecond
  });
}

function registerHotkey() {
  nativeHotkey = createGlobalHotkey({
    onPressed: () => mouseMover.toggle(),
    onError: handleHotkeyError
  });
}

function handleHotkeyError(error) {
  hotkeyError = `Could not enable Ctrl+F12: ${error.message}`;
  sendMessageToRenderer('hotkey-error', { message: hotkeyError });
}

function registerIpcHandlers() {
  ipcMain.handle('mouse-mover:get-state', () => mouseMover.isEnabled());
  ipcMain.handle('mouse-mover:toggle', () => mouseMover.toggle());
  ipcMain.handle('mouse-mover:get-hotkey-status', () => ({
    registered: !hotkeyError,
    message: hotkeyError
  }));
}

function sendStateToRenderer(enabled) {
  sendMessageToRenderer('state-changed', { enabled });
}

function sendMovementError(error) {
  sendMessageToRenderer('movement-error', {
    message: `Could not move the cursor: ${error.message}`
  });
}

function sendMessageToRenderer(channel, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, message);
  }
}

function showStartupError(error) {
  dialog.showErrorBox(
    'Mouse Mover failed to start',
    `Could not access mouse control.\n\n${error.message}`
  );
  app.quit();
}

app.whenReady().then(() => {
  try {
    mouseMover = createMouseMover();
    registerIpcHandlers();
    createMainWindow();
    registerHotkey();
  } catch (error) {
    showStartupError(error);
  }
});

app.on('will-quit', () => {
  if (mouseMover) {
    mouseMover.stop();
  }

  if (nativeHotkey) {
    nativeHotkey.close();
  }

  if (cursorController) {
    cursorController.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
