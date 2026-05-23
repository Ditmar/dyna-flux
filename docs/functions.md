# DynaFlux Standard Library — Function Reference

All functions listed here are globally available inside your model's `initialize()` and `update()` methods. They mimic the behavior of Vensim built-ins and are implemented in [`/public/lib/dynaflux-stdlib.js`](../public/lib/dynaflux-stdlib.js).

Use the **fx** button in the formula editor to browse and insert function snippets directly.

---

## Time Functions

These functions return values that depend on the current simulation time. Always pass `this.time` as the last argument.

### `PULSE(start, width, time)`

Returns `1` during the half-open interval `[start, start + width)`, and `0` everywhere else.

| Parameter | Description |
|-----------|-------------|
| `start`   | Time at which the pulse begins |
| `width`   | Duration of the pulse |
| `time`    | Current simulation time — pass `this.time` |

**Example**
```js
// Birth-rate spike between t=10 and t=11
this.birthBoost = PULSE(10, 1, this.time) * 500;
```

---

### `PULSE_TRAIN(start, width, interval, end, time)`

Generates a series of pulses of duration `width` every `interval` time units, starting at `start` and stopping at `end` (`0` means no end).

| Parameter  | Description |
|------------|-------------|
| `start`    | First pulse start time |
| `width`    | Duration of each pulse |
| `interval` | Time between pulse starts |
| `end`      | Stop time (0 = never stop) |
| `time`     | `this.time` |

**Example**
```js
// Pulse every 5 units, 1 unit wide, from t=0 to t=100
this.dose = PULSE_TRAIN(0, 1, 5, 100, this.time) * 200;
```

---

### `RAMP(slope, start_time, time [, end_time])`

Linear ramp that increases at `slope` per time unit starting at `start_time`. Optionally flattens at `end_time`.

| Parameter    | Description |
|--------------|-------------|
| `slope`      | Rate of increase per time unit |
| `start_time` | Time ramp begins |
| `time`       | `this.time` |
| `end_time`   | *(optional)* Time at which the ramp stops increasing |

**Example**
```js
// Gradually increase pollution from t=20 at rate 0.5/year
this.pollution += RAMP(0.5, 20, this.time);
```

---

### `STEP(height, step_time, time)`

Returns `0` before `step_time`, then permanently jumps to `height`.

| Parameter   | Description |
|-------------|-------------|
| `height`    | Value after the step |
| `step_time` | Time of the step |
| `time`      | `this.time` |

**Example**
```js
// Policy kicks in at t=30
this.subsidy = STEP(1000, 30, this.time);
```

---

## Logic / Conditional

### `IF_THEN_ELSE(condition, trueVal, falseVal)`

Returns `trueVal` when `condition` is truthy, `falseVal` otherwise.

```js
this.netGrowth = IF_THEN_ELSE(this.population > 0, this.birthRate, 0);
```

---

### `CLIP(x, lo, hi)`

Clamps `x` to the range `[lo, hi]`.

```js
// Prevent stock from going negative
this.inventory = CLIP(this.inventory, 0, this.maxCapacity);
```

---

### `XIDZ(x, y, z)`

Returns `x / y`. If `y` equals zero, returns `z` instead of dividing by zero.

```js
// Fraction of capacity used; 0 if capacity is undefined
this.utilisation = XIDZ(this.demand, this.capacity, 0);
```

---

### `ZIDZ(x, y)`

Returns `x / y`. If `y` equals zero, returns `0`.

```js
this.perCapita = ZIDZ(this.totalIncome, this.population);
```

---

## Math Functions

| Function | Equivalent | Description |
|----------|------------|-------------|
| `ABS(x)` | `Math.abs(x)` | Absolute value |
| `LN(x)` | `Math.log(x)` | Natural logarithm |
| `EXP(x)` | `Math.exp(x)` | Exponential (e^x) |
| `SQRT(x)` | `Math.sqrt(x)` | Square root |
| `SIN(x)` | `Math.sin(x)` | Sine (radians) |
| `COS(x)` | `Math.cos(x)` | Cosine (radians) |
| `TAN(x)` | `Math.tan(x)` | Tangent (radians) |
| `INTEGER(x)` | `Math.floor(x)` | Floor to integer |
| `MODULO(x, m)` | `((x%m)+m)%m` | Modulo — always ≥ 0 |
| `RANDOM_UNIFORM(min, max)` | — | Uniform random in [min, max) |

**Constant:** `PI` = `Math.PI`

**Examples**
```js
this.angle     = MODULO(this.theta, 2 * PI);
this.amplitude = ABS(SIN(this.time * 0.1)) * this.maxAmp;
this.noise     = RANDOM_UNIFORM(-0.05, 0.05) * this.signal;
```

---

## Stateful Functions — Delays & Smoothing

These functions maintain internal state across time steps. They automatically reset at the start of each new simulation run.

### How the `id` parameter works

Each stateful function call needs a **unique string identifier** (the `id` parameter) so the library can store its state independently from other calls. If two calls share the same `id`, they will share state — which is almost always a bug. Use descriptive names:

```js
// Good — each call has its own unique id
this.smoothPrey     = SMOOTH('smoothPrey',     this.prey,     5, this.time, this.dt, 0);
this.smoothPredator = SMOOTH('smoothPredator', this.predator, 5, this.time, this.dt, 0);

// Bad — they share state!
this.smoothPrey     = SMOOTH('s', this.prey,     5, this.time, this.dt, 0);
this.smoothPredator = SMOOTH('s', this.predator, 5, this.time, this.dt, 0);
```

---

### `SMOOTH(id, input, averaging_time, time, dt [, initial])`

First-order exponential smoothing (low-pass filter). Solves:

```
d(level)/dt = (input − level) / averaging_time
```

| Parameter       | Description |
|-----------------|-------------|
| `id`            | Unique string key for this state |
| `input`         | The signal to smooth |
| `averaging_time`| Time constant — larger = slower response |
| `time`          | `this.time` |
| `dt`            | `this.dt` |
| `initial`       | *(optional)* Initial level (defaults to `input` value at t₀) |

**Example**
```js
// Smooth perceived price with 3-period averaging time
this.perceivedPrice = SMOOTH('perceivedPrice', this.price, 3, this.time, this.dt, 10);
```

---

### `DELAY1(id, input, delay_time, time, dt [, initial])`

First-order exponential delay — mathematically identical to `SMOOTH`. Use this alias when the intent is a pipeline delay rather than noise filtering.

```js
this.shippingLine = DELAY1('shipping', this.orders, 4, this.time, this.dt, 0);
```

---

### `DELAY3(id, input, delay_time, time, dt [, initial])`

Third-order pipeline delay: three cascaded first-order delays, each with time constant `delay_time / 3`. Produces a sharper response with less distortion than `DELAY1` for the same total delay — closer to a true fixed delay.

```js
// Material transit takes 6 time units; DELAY3 gives a more realistic shape
this.inTransit = DELAY3('transit', this.shipments, 6, this.time, this.dt, 0);
```

**DELAY1 vs DELAY3 — when to use which**

| | DELAY1 | DELAY3 |
|---|---|---|
| Shape | Very smooth, slow rise | Faster rise, closer to "box" delay |
| Use case | Perception, learning | Physical pipelines, supply chains |

---

### `TREND(id, input, averaging_time, time, dt)`

Computes the relative fractional rate of change of `input` over `averaging_time`:

```
TREND = (input − SMOOTH(input)) / (SMOOTH(input) × averaging_time)
```

Returns a dimensionless fraction per time unit (e.g., `0.03` = 3 % per year).

| Parameter       | Description |
|-----------------|-------------|
| `id`            | Unique string key |
| `input`         | The variable being tracked |
| `averaging_time`| Smoothing window |
| `time`          | `this.time` |
| `dt`            | `this.dt` |

**Example**
```js
// Growth rate of population (fraction per year)
this.populationGrowthRate = TREND('popTrend', this.population, 5, this.time, this.dt);
```

---

## Common Patterns

### Logistic growth with carrying capacity
```js
// In update() loop
this.growthRate = this.r * this.population * (1 - this.population / this.K);
this.population += this.growthRate * this.dt;
```

### Oscillating input (sinusoidal forcing)
```js
this.forcing = this.amplitude * SIN(2 * PI * this.time / this.period);
```

### Policy that ramps in and then stays constant
```js
this.policy = CLIP(RAMP(0.1, 10, this.time), 0, 1);
```

### Detecting threshold crossings
```js
this.alarm = IF_THEN_ELSE(this.inventory < this.safetyStock, 1, 0);
```

### Lagged response to market signal (supply chain)
```js
this.perceivedDemand = DELAY3('percDemand', this.actualDemand, 8, this.time, this.dt, 100);
this.productionOrder = CLIP(this.perceivedDemand * (1 + TREND('demTrend', this.actualDemand, 6, this.time, this.dt)), 0, this.maxCapacity);
```
