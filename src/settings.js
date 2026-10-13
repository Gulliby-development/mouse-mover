const DEFAULT_SPEED_PX_PER_SECOND = 200;
const MIN_SPEED_PX_PER_SECOND = 50;
const MAX_SPEED_PX_PER_SECOND = 1_000;

function stringifyWarningValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable value]';
    }
  }
}

function readSpeed(env) {
  const value = env?.MOUSE_MOVER_SPEED;

  if (value === undefined || value === '') {
    return {
      speedPxPerSecond: DEFAULT_SPEED_PX_PER_SECOND,
      warning: null
    };
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (/^[0-9]{1,4}$/.test(trimmedValue)) {
      const speedPxPerSecond = Number(trimmedValue);

      if (
        speedPxPerSecond >= MIN_SPEED_PX_PER_SECOND &&
        speedPxPerSecond <= MAX_SPEED_PX_PER_SECOND
      ) {
        return { speedPxPerSecond, warning: null };
      }
    }
  }

  return {
    speedPxPerSecond: DEFAULT_SPEED_PX_PER_SECOND,
    warning:
      `Ignoring MOUSE_MOVER_SPEED=${stringifyWarningValue(value)}: ` +
      `expected an integer from ${MIN_SPEED_PX_PER_SECOND} through ${MAX_SPEED_PX_PER_SECOND}. ` +
      `Using ${DEFAULT_SPEED_PX_PER_SECOND}.`
  };
}

module.exports = {
  DEFAULT_SPEED_PX_PER_SECOND,
  MIN_SPEED_PX_PER_SECOND,
  MAX_SPEED_PX_PER_SECOND,
  readSpeed
};
