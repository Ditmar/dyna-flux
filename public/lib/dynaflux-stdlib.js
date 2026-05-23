/**
 * DynaFlux Standard Library
 * Vensim-compatible helper functions for system dynamics models.
 * All stateful functions auto-detect simulation restarts by watching
 * whether `time` decreased since the last call (each new update() run
 * resets the simulation clock back to initTime).
 */

/* ── Internal state registry for stateful functions ── */
var _df_state = {};

function _df_reset_check(name, time) {
  if (!_df_state[name]) return true;
  return time <= _df_state[name]._t;
}

/* ══════════════════════════════════════════════════════
   TIME FUNCTIONS
   ══════════════════════════════════════════════════════ */

/**
 * PULSE(start, width, time)
 * Returns 1 during the interval [start, start+width), 0 otherwise.
 */
function PULSE(start, width, time) {
  return (time >= start && time < start + width) ? 1 : 0;
}

/**
 * PULSE_TRAIN(start, width, interval, end, time)
 * Repeating pulses of `width` duration every `interval` time units,
 * beginning at `start` and stopping at `end` (0 = no end).
 */
function PULSE_TRAIN(start, width, interval, end, time) {
  if (time < start) return 0;
  if (end > 0 && time >= end) return 0;
  var t = (time - start) % interval;
  return (t >= 0 && t < width) ? 1 : 0;
}

/**
 * RAMP(slope, start_time, time [, end_time])
 * Linear increase of `slope` per time unit, starting at `start_time`.
 * Optionally flattens at `end_time`.
 */
function RAMP(slope, start_time, time, end_time) {
  if (time < start_time) return 0;
  var elapsed = time - start_time;
  if (end_time !== undefined && time >= end_time) elapsed = end_time - start_time;
  return slope * elapsed;
}

/**
 * STEP(height, step_time, time)
 * Returns 0 before `step_time`, then jumps to `height`.
 */
function STEP(height, step_time, time) {
  return time >= step_time ? height : 0;
}

/* ══════════════════════════════════════════════════════
   LOGIC / CONDITIONAL
   ══════════════════════════════════════════════════════ */

/**
 * IF_THEN_ELSE(condition, trueVal, falseVal)
 * Returns trueVal when condition is truthy, falseVal otherwise.
 */
function IF_THEN_ELSE(condition, trueVal, falseVal) {
  return condition ? trueVal : falseVal;
}

/**
 * CLIP(x, lo, hi)
 * Clamps x to the range [lo, hi].
 */
function CLIP(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * XIDZ(x, y, z)
 * Returns x / y; if y equals zero, returns z instead.
 */
function XIDZ(x, y, z) {
  return y === 0 ? z : x / y;
}

/**
 * ZIDZ(x, y)
 * Returns x / y; if y equals zero, returns 0.
 */
function ZIDZ(x, y) {
  return y === 0 ? 0 : x / y;
}

/* ══════════════════════════════════════════════════════
   MATH HELPERS
   ══════════════════════════════════════════════════════ */

/** Absolute value */
function ABS(x)  { return Math.abs(x); }
/** Natural logarithm (base e) */
function LN(x)   { return Math.log(x); }
/** Exponential: e^x */
function EXP(x)  { return Math.exp(x); }
/** Square root */
function SQRT(x) { return Math.sqrt(x); }
/** Sine (radians) */
function SIN(x)  { return Math.sin(x); }
/** Cosine (radians) */
function COS(x)  { return Math.cos(x); }
/** Tangent (radians) */
function TAN(x)  { return Math.tan(x); }
/** Floor to integer */
function INTEGER(x) { return Math.floor(x); }
/** Modulo — always returns a non-negative result */
function MODULO(x, m) { return ((x % m) + m) % m; }
/** Uniform random number in [min, max) */
function RANDOM_UNIFORM(min, max) { return min + Math.random() * (max - min); }

var PI = Math.PI;

/* ══════════════════════════════════════════════════════
   STATEFUL: DELAYS & SMOOTHING
   Each function requires a unique string `id` so the
   library can maintain independent state per variable.
   State is automatically reset whenever `time` is less
   than or equal to the last recorded time (which happens
   at the start of every new simulation run).
   ══════════════════════════════════════════════════════ */

/**
 * SMOOTH(id, input, averaging_time, time, dt [, initial])
 * First-order exponential smoothing (low-pass filter).
 * Differential equation: d(level)/dt = (input − level) / averaging_time
 */
function SMOOTH(id, input, averaging_time, time, dt, initial) {
  if (_df_reset_check(id, time)) {
    _df_state[id] = { level: initial !== undefined ? initial : input, _t: time - 1 };
  }
  var s  = _df_state[id];
  var at = Math.max(averaging_time, dt);
  s.level += ((input - s.level) / at) * dt;
  s._t = time;
  return s.level;
}

/**
 * DELAY1(id, input, delay_time, time, dt [, initial])
 * First-order exponential delay — mathematically identical to SMOOTH.
 * Useful as a named alias to distinguish modelling intent.
 */
function DELAY1(id, input, delay_time, time, dt, initial) {
  return SMOOTH(id, input, delay_time, time, dt, initial);
}

/**
 * DELAY3(id, input, delay_time, time, dt [, initial])
 * Third-order pipeline delay: three cascaded first-order delays each
 * of duration delay_time/3. Produces a sharper, less distorted response
 * than DELAY1 with the same total delay.
 */
function DELAY3(id, input, delay_time, time, dt, initial) {
  if (_df_reset_check(id, time)) {
    var iv = initial !== undefined ? initial : input;
    _df_state[id] = { s1: iv, s2: iv, s3: iv, _t: time - 1 };
  }
  var s  = _df_state[id];
  var at = Math.max(delay_time / 3, dt);
  s.s1 += ((input  - s.s1) / at) * dt;
  s.s2 += ((s.s1   - s.s2) / at) * dt;
  s.s3 += ((s.s2   - s.s3) / at) * dt;
  s._t = time;
  return s.s3;
}

/**
 * TREND(id, input, averaging_time, time, dt)
 * Relative fractional rate of change of input over averaging_time.
 * Formula: (input − SMOOTH(input)) / (SMOOTH(input) × averaging_time)
 */
function TREND(id, input, averaging_time, time, dt) {
  var smoothId = id + '_trend_s';
  if (_df_reset_check(smoothId, time)) {
    _df_state[smoothId] = { level: input, _t: time - 1 };
  }
  var s  = _df_state[smoothId];
  var at = Math.max(averaging_time, dt);
  s.level += ((input - s.level) / at) * dt;
  s._t = time;
  var smoothed = s.level;
  return smoothed === 0 ? 0 : (input - smoothed) / (smoothed * at);
}
