const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_SPEED_PX_PER_SECOND,
  MIN_SPEED_PX_PER_SECOND,
  MAX_SPEED_PX_PER_SECOND,
  readSpeed
} = require('../src/settings');

test('exports the default speed and inclusive speed bounds', () => {
  assert.equal(DEFAULT_SPEED_PX_PER_SECOND, 200);
  assert.equal(MIN_SPEED_PX_PER_SECOND, 50);
  assert.equal(MAX_SPEED_PX_PER_SECOND, 1000);
});

test('readSpeed uses the default when the setting is undefined or empty', () => {
  assert.deepEqual(readSpeed({}), { speedPxPerSecond: 200, warning: null });
  assert.deepEqual(readSpeed({ MOUSE_MOVER_SPEED: '' }), {
    speedPxPerSecond: 200,
    warning: null
  });
});

test('readSpeed accepts each specified valid speed', () => {
  const validValues = [
    ['300', 300],
    [' 300 ', 300],
    ['0300', 300],
    ['50', 50],
    ['1000', 1000]
  ];

  for (const [value, speedPxPerSecond] of validValues) {
    assert.deepEqual(readSpeed({ MOUSE_MOVER_SPEED: value }), {
      speedPxPerSecond,
      warning: null
    });
  }
});

test('readSpeed rejects each specified invalid speed with the exact warning', () => {
  const invalidValues = [
    '49',
    '1001',
    'abc',
    '1e2',
    '+300',
    '300.5',
    '12345',
    '٣٠٠',
    '   '
  ];

  for (const value of invalidValues) {
    assert.deepEqual(readSpeed({ MOUSE_MOVER_SPEED: value }), {
      speedPxPerSecond: 200,
      warning:
        `Ignoring MOUSE_MOVER_SPEED=${JSON.stringify(value)}: ` +
        'expected an integer from 50 through 1000. Using 200.'
    });
  }

  assert.equal(
    readSpeed({ MOUSE_MOVER_SPEED: 'abc' }).warning,
    'Ignoring MOUSE_MOVER_SPEED="abc": expected an integer from 50 through 1000. Using 200.'
  );
});

test('readSpeed rejects values that JSON cannot serialize without throwing', () => {
  assert.deepEqual(readSpeed({ MOUSE_MOVER_SPEED: 300n }), {
    speedPxPerSecond: 200,
    warning:
      'Ignoring MOUSE_MOVER_SPEED=300: expected an integer from 50 through 1000. Using 200.'
  });
});

test('readSpeed does not modify its input object', () => {
  const inputs = [
    {},
    { MOUSE_MOVER_SPEED: '' },
    { MOUSE_MOVER_SPEED: '0300', otherSetting: 'unchanged' },
    { MOUSE_MOVER_SPEED: '  abc  ', otherSetting: 'unchanged' }
  ];

  for (const env of inputs) {
    const before = { ...env };
    readSpeed(env);
    assert.deepEqual(env, before);
  }
});
