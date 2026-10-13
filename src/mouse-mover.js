const { DEFAULT_SPEED_PX_PER_SECOND } = require('./settings');
const TARGET_TRAVEL_TIME_MS = 3_000;
const MIN_TARGET_DISTANCE_PX = 400;
const MAX_TARGET_DISTANCE_PX = 800;
const TARGET_SEARCH_ATTEMPTS = 20;
const MAX_CURVE_OFFSET_PX = 200;

class MouseMover {
  constructor({
    cursor,
    getScreenBounds,
    random = Math.random,
    onStateChanged = () => {},
    onError = () => {},
    speedPxPerSecond = DEFAULT_SPEED_PX_PER_SECOND
  }) {
    this.cursor = cursor;
    this.getScreenBounds = getScreenBounds;
    this.random = random;
    this.onStateChanged = onStateChanged;
    this.onError = onError;
    this.speedPxPerSecond = speedPxPerSecond;
    this.enabled = false;
    this.currentPosition = null;
    this.movementPromise = null;
  }

  start() {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.onStateChanged(this.enabled);
    this.movementPromise = this.moveContinuously();
  }

  stop() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.cancelActiveMovement();
    this.onStateChanged(this.enabled);
  }

  toggle() {
    if (this.enabled) {
      this.stop();
    } else {
      this.start();
    }

    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  async moveContinuously() {
    try {
      this.currentPosition = await this.readCurrentPosition();

      while (this.enabled) {
        await this.moveToNextTarget();
      }
    } catch (error) {
      this.handleMovementError(error);
    } finally {
      this.movementPromise = null;
    }
  }

  async moveToNextTarget() {
    const targetPosition = createTargetPosition(
      this.getScreenBounds(),
      this.currentPosition,
      this.random
    );
    const movementPlan = createMovementPlan(
      this.currentPosition,
      targetPosition,
      this.random,
      this.speedPxPerSecond
    );

    await this.cursor.moveTo(targetPosition, movementPlan);
    this.currentPosition = targetPosition;
  }

  async readCurrentPosition() {
    if (typeof this.cursor.getPosition === 'function') {
      return this.cursor.getPosition();
    }

    return getScreenCenter(this.getScreenBounds());
  }

  cancelActiveMovement() {
    if (typeof this.cursor.cancelMovement === 'function') {
      this.cursor.cancelMovement();
    }
  }

  handleMovementError(error) {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.onError(error);
    this.onStateChanged(this.enabled);
  }
}

function createTargetPosition(bounds, currentPosition, random) {
  const targetDistance = getTargetDistance();
  let bestCandidate;
  let smallestDistanceDifference = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < TARGET_SEARCH_ATTEMPTS; attempt += 1) {
    const candidate = getRandomPosition(bounds, random);
    const distance = distanceBetween(currentPosition, candidate);
    const distanceDifference = Math.abs(distance - targetDistance);

    if (distanceDifference < smallestDistanceDifference) {
      bestCandidate = candidate;
      smallestDistanceDifference = distanceDifference;
    }

    if (distance >= MIN_TARGET_DISTANCE_PX && distance <= MAX_TARGET_DISTANCE_PX) {
      return candidate;
    }
  }

  if (bestCandidate && distanceBetween(currentPosition, bestCandidate) > 0) {
    return bestCandidate;
  }

  return createFallbackTarget(bounds, currentPosition, targetDistance, random);
}

function createMovementPlan(
  currentPosition,
  targetPosition,
  random,
  speedPxPerSecond = DEFAULT_SPEED_PX_PER_SECOND
) {
  const distance = distanceBetween(currentPosition, targetPosition);
  const durationMs = Math.max(
    1_000,
    Math.round(distance / speedPxPerSecond * 1_000)
  );
  const maximumCurveOffset = Math.min(distance * 0.35, MAX_CURVE_OFFSET_PX);
  const curveOffset = Math.round((random() - 0.5) * maximumCurveOffset);

  return { durationMs, curveOffset };
}

function getTargetDistance() {
  return DEFAULT_SPEED_PX_PER_SECOND * TARGET_TRAVEL_TIME_MS / 1_000;
}

function createFallbackTarget(bounds, currentPosition, targetDistance, random) {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  const firstDirection = randomInteger(0, directions.length - 1, random());

  for (let offset = 0; offset < directions.length; offset += 1) {
    const direction = directions[(firstDirection + offset) % directions.length];
    const candidate = {
      x: clamp(
        currentPosition.x + direction.x * targetDistance,
        bounds.left,
        bounds.left + bounds.width - 1
      ),
      y: clamp(
        currentPosition.y + direction.y * targetDistance,
        bounds.top,
        bounds.top + bounds.height - 1
      )
    };

    if (distanceBetween(currentPosition, candidate) > 0) {
      return candidate;
    }
  }

  return currentPosition;
}

function getScreenCenter(bounds) {
  return {
    x: Math.round(bounds.left + (bounds.width - 1) / 2),
    y: Math.round(bounds.top + (bounds.height - 1) / 2)
  };
}

function getRandomPosition(bounds, random) {
  const right = bounds.left + bounds.width - 1;
  const bottom = bounds.top + bounds.height - 1;

  return {
    x: randomInteger(bounds.left, right, random()),
    y: randomInteger(bounds.top, bottom, random())
  };
}

function randomInteger(minimum, maximum, randomValue) {
  const boundedRandomValue = Math.min(Math.max(randomValue, 0), 0.999999999);
  return Math.floor(minimum + boundedRandomValue * (maximum - minimum + 1));
}

function distanceBetween(firstPosition, secondPosition) {
  return Math.hypot(
    secondPosition.x - firstPosition.x,
    secondPosition.y - firstPosition.y
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

module.exports = {
  MouseMover,
  createMovementPlan,
  createTargetPosition,
  getRandomPosition
};
