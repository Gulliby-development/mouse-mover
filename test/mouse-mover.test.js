const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MouseMover,
  createMovementPlan,
  createTargetPosition,
  getRandomPosition
} = require('../src/mouse-mover');

function waitForMovementCycle() {
  return new Promise(resolve => setImmediate(resolve));
}

function createRandomSequence(values) {
  let valueIndex = 0;

  return () => values[valueIndex++] ?? 0.5;
}

test('the mouse mover starts disabled', () => {
  const mover = new MouseMover({
    cursor: {
      getPosition: async () => ({ x: 0, y: 0 }),
      moveTo() {}
    },
    getScreenBounds: () => ({ left: 0, top: 0, width: 100, height: 100 })
  });

  assert.equal(mover.isEnabled(), false);
});

test('getRandomPosition returns a point inside screen bounds', () => {
  const bounds = { left: 100, top: 50, width: 800, height: 600 };

  const position = getRandomPosition(bounds, () => 0.5);

  assert.deepEqual(position, { x: 500, y: 350 });
});

test('createTargetPosition chooses a point far enough for a visible movement', () => {
  const bounds = { left: 0, top: 0, width: 1920, height: 1080 };
  const currentPosition = { x: 960, y: 540 };
  const random = createRandomSequence([0.75, 0.5]);

  const targetPosition = createTargetPosition(bounds, currentPosition, random);

  assert.deepEqual(targetPosition, { x: 1440, y: 540 });
});

test('createTargetPosition never stays at the current point', () => {
  const bounds = { left: 0, top: 0, width: 1920, height: 1080 };
  const currentPosition = { x: 0, y: 0 };

  const targetPosition = createTargetPosition(bounds, currentPosition, () => 0);

  assert.notDeepEqual(targetPosition, currentPosition);
});

test('createMovementPlan targets roughly three seconds at 200 pixels per second', () => {
  const currentPosition = { x: 0, y: 0 };
  const targetPosition = { x: 600, y: 0 };

  const movementPlan = createMovementPlan(currentPosition, targetPosition, () => 0.5);

  assert.deepEqual(movementPlan, { durationMs: 3000, curveOffset: 0 });
});

test('starting the mouse mover starts a movement segment immediately', async () => {
  const movedTo = [];
  let mover;
  const cursor = {
    getPosition: async () => ({ x: 960, y: 540 }),
    moveTo: async position => {
      movedTo.push(position);
      mover.stop();
    }
  };
  mover = new MouseMover({
    cursor,
    getScreenBounds: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
    random: createRandomSequence([0.75, 0.5]),
    startInterval: () => 1,
    stopInterval: () => {}
  });

  mover.start();
  await waitForMovementCycle();

  assert.equal(movedTo.length, 1);
});

test('stopping the mouse mover cancels the active movement', () => {
  let movementWasCancelled = false;
  const mover = new MouseMover({
    cursor: {
      getPosition: () => new Promise(() => {}),
      moveTo() {},
      cancelMovement: () => { movementWasCancelled = true; }
    },
    getScreenBounds: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
    startInterval: () => 1,
    stopInterval: () => {}
  });

  mover.start();
  mover.stop();

  assert.equal(movementWasCancelled, true);
  assert.equal(mover.isEnabled(), false);
});

test('toggle changes the enabled state', () => {
  const mover = new MouseMover({
    cursor: {
      getPosition: async () => ({ x: 0, y: 0 }),
      moveTo() {},
      cancelMovement() {}
    },
    getScreenBounds: () => ({ left: 0, top: 0, width: 100, height: 100 })
  });

  assert.equal(mover.toggle(), true);
  assert.equal(mover.toggle(), false);
});
