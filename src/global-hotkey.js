const { uIOhook, UiohookKey } = require('uiohook-napi');

function createGlobalHotkey({
  onPressed,
  onError,
  keyboardSource = uIOhook,
  f12KeyCode = UiohookKey.F12
}) {
  let f12IsDown = false;

  const handleKeyDown = event => {
    if (event.keycode === f12KeyCode && event.ctrlKey && !f12IsDown) {
      f12IsDown = true;
      onPressed();
    }
  };
  const handleKeyUp = event => {
    if (event.keycode === f12KeyCode) {
      f12IsDown = false;
    }
  };

  try {
    keyboardSource.on('keydown', handleKeyDown);
    keyboardSource.on('keyup', handleKeyUp);
    keyboardSource.start();
  } catch (error) {
    removeListeners(keyboardSource, handleKeyDown, handleKeyUp);
    onError(new Error('Could not start the global keyboard listener.', { cause: error }));
  }

  return {
    close() {
      removeListeners(keyboardSource, handleKeyDown, handleKeyUp);
      keyboardSource.stop();
    }
  };
}

function removeListeners(keyboardSource, handleKeyDown, handleKeyUp) {
  keyboardSource.off('keydown', handleKeyDown);
  keyboardSource.off('keyup', handleKeyUp);
}

module.exports = { createGlobalHotkey };
