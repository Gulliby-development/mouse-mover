const { EventEmitter } = require('node:events');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createGlobalHotkey } = require('../src/global-hotkey');

class FakeKeyboardSource extends EventEmitter {
  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
  }
}

function createKeyboardSource() {
  return new FakeKeyboardSource();
}

test('Ctrl+F12 triggers once until F12 is released', () => {
  const keyboardSource = createKeyboardSource();
  let pressCount = 0;
  const hotkey = createGlobalHotkey({
    onPressed: () => pressCount += 1,
    onError: error => { throw error; },
    keyboardSource,
    f12KeyCode: 88
  });

  keyboardSource.emit('keydown', { keycode: 88, ctrlKey: true });
  keyboardSource.emit('keydown', { keycode: 88, ctrlKey: true });

  assert.equal(pressCount, 1);
  hotkey.close();
});

test('releasing F12 allows the next Ctrl+F12 press', () => {
  const keyboardSource = createKeyboardSource();
  let pressCount = 0;
  const hotkey = createGlobalHotkey({
    onPressed: () => pressCount += 1,
    onError: error => { throw error; },
    keyboardSource,
    f12KeyCode: 88
  });

  keyboardSource.emit('keydown', { keycode: 88, ctrlKey: true });
  keyboardSource.emit('keyup', { keycode: 88 });
  keyboardSource.emit('keydown', { keycode: 88, ctrlKey: true });

  assert.equal(pressCount, 2);
  hotkey.close();
});

test('F12 without Ctrl does not trigger the hotkey', () => {
  const keyboardSource = createKeyboardSource();
  let pressCount = 0;
  const hotkey = createGlobalHotkey({
    onPressed: () => pressCount += 1,
    onError: error => { throw error; },
    keyboardSource,
    f12KeyCode: 88
  });

  keyboardSource.emit('keydown', { keycode: 88, ctrlKey: false });

  assert.equal(pressCount, 0);
  hotkey.close();
});
