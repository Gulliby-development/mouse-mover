# Mouse Mover

A small Windows Electron app that keeps the cursor moving naturally across the primary display. It follows slightly curved paths at about 200 px/s and selects a new destination roughly every three seconds of travel. As soon as one destination is reached, movement continues toward the next one.

The app never clicks, types, scrolls, or performs any other input action.

## Controls

- The app starts with movement disabled.
- Press `Ctrl + F12` to toggle movement globally.
- You can also toggle movement with the button in the app window.

## Run from source

Requires Node.js 22.12 or newer and Windows 10/11.

```powershell
npm install
npm start
```

## Build the installer

```powershell
npm test
npm run package
```

The installer will be created at `dist/Mouse Mover Setup 1.0.0.exe`.

The app uses Windows PowerShell for cursor control and `uiohook-napi` for the global hotkey.
