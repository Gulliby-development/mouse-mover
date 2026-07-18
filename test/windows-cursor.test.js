const test = require('node:test');
const assert = require('node:assert/strict');

const { parseScreenBounds } = require('../src/windows-cursor');

test('parseScreenBounds converts PowerShell output to screen bounds', () => {
  const bounds = parseScreenBounds('0,0,1920,1080\r\n');

  assert.deepEqual(bounds, { left: 0, top: 0, width: 1920, height: 1080 });
});

test('parseScreenBounds rejects invalid screen dimensions', () => {
  assert.throws(
    () => parseScreenBounds('0,0,0,1080'),
    /invalid screen size/
  );
});
