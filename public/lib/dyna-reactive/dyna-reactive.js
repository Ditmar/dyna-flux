/**
 * DynaReactive — reactive runtime for DynaFlux explorable models.
 *
 * Modern, dependency-free replacement for Tangle.js + TangleKit (2011, MooTools).
 * It keeps Tangle's public API so every existing model and HTML panel keeps working:
 *
 *   const rt = new DynaReactive(rootElement, {
 *     initialize() { this.k = 0.5; },       // runs once
 *     update()     { this.y = this.k * 2; } // runs after every change
 *   });
 *
 *   <span data-var="k" class="TKAdjustableNumber" data-min="0" data-max="1" data-step="0.01"></span>
 *   <span data-var="y" data-format="%.2f"></span>
 *
 * Improvements over Tangle:
 *   - No MooTools (it patched Array/Function/Number prototypes) and no sprintf.js.
 *   - Pointer Events: mouse, touch and pen with pointer capture.
 *   - update() is coalesced to one run per animation frame while dragging,
 *     so heavy simulations + Plotly redraws do not queue up.
 *   - Keyboard accessible (role="slider", arrows, Shift, PageUp/Down, Home/End).
 *   - Double-click (or Enter) on a number to type an exact value.
 *   - Range-aware drag sensitivity; hold Shift while dragging for fine control.
 *   - Model errors are shown on screen instead of failing silently.
 *   - Extra controls: dr-slider (range input), dr-input, dr-toggle, dr-if, dr-switch.
 *
 * The legacy class names (TKAdjustableNumber, TKNumberField, TKToggle, TKIf,
 * TKSwitch) are aliases of the new ones, and `window.Tangle` points to DynaReactive.
 */
(function (global) {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /** Number of decimals needed to represent `step` (0.25 → 2, 1e-3 → 3). */
  function decimalsOf(step) {
    if (!isFinite(step)) return 0;
    const s = String(step);
    if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
    const dot = s.indexOf('.');
    return dot < 0 ? 0 : s.length - dot - 1;
  }

  /** Round to `decimals` places and strip floating point noise. */
  const roundTo = (v, decimals) => Number(v.toFixed(Math.min(decimals, 100)));

  /** Default number formatting: up to 6 significant digits, no float noise. */
  function defaultFormat(value) {
    if (typeof value === 'number') {
      if (!isFinite(value)) return String(value);
      if (Number.isInteger(value)) return String(value);
      return String(Number(value.toPrecision(6)));
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return value === undefined || value === null ? '' : String(value);
  }

  /** Small printf: supports %d %i %f %e %g %s %x %% with flags, width and precision. */
  function sprintf(format, ...args) {
    let i = 0;
    return format.replace(/%([-+ 0]*)(\d+)?(?:\.(\d+))?([diufeEgGsxX%])/g, (m, flags, width, prec, type) => {
      if (type === '%') return '%';
      let v = args[i++];
      const p = prec !== undefined ? parseInt(prec, 10) : undefined;
      let out;
      switch (type) {
        case 'd': case 'i': case 'u': out = String(Math.round(Number(v))); break;
        case 'f': out = Number(v).toFixed(p ?? 6); break;
        case 'e': case 'E': out = Number(v).toExponential(p ?? 6); if (type === 'E') out = out.toUpperCase(); break;
        case 'g': case 'G': out = String(Number(Number(v).toPrecision(p || 6))); break;
        case 'x': case 'X': out = Math.round(Number(v)).toString(16); if (type === 'X') out = out.toUpperCase(); break;
        default: out = String(v); if (p !== undefined) out = out.slice(0, p);
      }
      if (/[+]/.test(flags) && type !== 's' && Number(v) >= 0) out = '+' + out;
      else if (/ /.test(flags) && type !== 's' && Number(v) >= 0) out = ' ' + out;
      const w = width ? parseInt(width, 10) : 0;
      if (out.length < w) {
        if (flags.includes('-')) out = out.padEnd(w);
        else if (flags.includes('0') && type !== 's') {
          const sign = /^[+\- ]/.test(out) ? out[0] : '';
          out = sign + out.slice(sign.length).padStart(w - sign.length, '0');
        } else out = out.padStart(w);
      }
      return out;
    });
  }

  /** Read data-* attributes as Tangle did: data-max="5" → { max: "5" }. */
  function optionsFor(element) {
    const options = {};
    for (const attr of element.attributes) {
      if (/^data-[\w-]+$/.test(attr.name)) options[attr.name.slice(5)] = attr.value;
    }
    return options;
  }

  const num = (v, fallback) => {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  };

  // ────────────────────────────────────────────────────────────────────────
  // Error banner
  // ────────────────────────────────────────────────────────────────────────

  let errorBox = null;

  function showError(err) {
    const message = (err && (err.message || err)) || 'Unknown error';
    console.error('[DynaReactive]', err);
    if (!document.body) return;
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.className = 'dr-error';
      errorBox.setAttribute('role', 'alert');
      document.body.appendChild(errorBox);
    }
    errorBox.textContent = '⚠ Error en el modelo: ' + message;
    errorBox.hidden = false;
  }

  function clearError() {
    if (errorBox) errorBox.hidden = true;
  }

  // Syntax errors in the model script happen before any runtime exists:
  // surface them too, otherwise the panel just stays blank.
  global.addEventListener('error', (e) => {
    if (e && e.message) {
      const show = () => showError(e.error || e.message);
      document.body ? show() : global.addEventListener('DOMContentLoaded', show, { once: true });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Runtime
  // ────────────────────────────────────────────────────────────────────────

  class DynaReactive {
    /**
     * @param {Element} root      Element whose descendants are scanned for data-var / controls.
     * @param {object}  modelDef  Object with initialize() and update() methods.
     */
    constructor(root, modelDef) {
      this.element = root || document.body;
      this._model = null;
      this._bindings = new Map();   // varName → binding[]
      this._controls = [];
      this._subscribers = new Set();
      this._frame = 0;
      this._dirty = false;

      this._scan();
      if (modelDef) this.setModel(modelDef);
    }

    // ── Public API (Tangle-compatible) ───────────────────────────────────

    setModel(modelDef) {
      this._model = Object.create(modelDef);
      this._run(true);
    }

    getValue(name) {
      const value = this._model[name];
      if (value === undefined) {
        console.warn('[DynaReactive] unknown variable: ' + name);
        return 0;
      }
      return value;
    }

    setValue(name, value) {
      this.setValues({ [name]: value });
    }

    /**
     * Set variables. Bound views update immediately; the model's update()
     * is scheduled once per animation frame (pass { sync: true } to run now).
     */
    setValues(values, { sync = false } = {}) {
      const changed = [];
      for (const [name, value] of Object.entries(values)) {
        const old = this._model[name];
        if (old === undefined) {
          console.warn('[DynaReactive] setting unknown variable: ' + name);
          continue;
        }
        if (old === value) continue;
        this._model[name] = value;
        changed.push(name);
      }
      if (!changed.length) return;
      this._apply(changed);
      this._dirty = true;
      if (sync) this.flush();
      else if (!this._frame) this._frame = requestAnimationFrame(() => this.flush());
    }

    /** Run any pending update() immediately. */
    flush() {
      if (this._frame) cancelAnimationFrame(this._frame);
      this._frame = 0;
      if (!this._dirty) return;
      this._dirty = false;
      this._run(false);
    }

    /** Listen to changes: fn(changedNames, runtime). Returns an unsubscribe function. */
    subscribe(fn) {
      this._subscribers.add(fn);
      return () => this._subscribers.delete(fn);
    }

    /** Remove listeners added by controls. */
    destroy() {
      if (this._frame) cancelAnimationFrame(this._frame);
      this._controls.forEach((c) => c.destroy && c.destroy());
      this._controls = [];
      this._bindings.clear();
      this._subscribers.clear();
    }

    /** Format `value` according to an element's data-format / data-step. */
    format(element, value, varNames) {
      return this._formatterFor(element, varNames || [])(value);
    }

    // ── Internals ────────────────────────────────────────────────────────

    _run(initialize) {
      // Like Tangle: run on a shadow object so we can see exactly which
      // properties initialize()/update() assigned.
      const shadow = Object.create(this._model);
      try {
        if (initialize && typeof shadow.initialize === 'function') shadow.initialize();
        if (typeof shadow.update === 'function') shadow.update();
        clearError();
      } catch (err) {
        showError(err);
      }
      const changed = [];
      for (const name of Object.keys(shadow)) {
        if (this._model[name] === shadow[name]) continue;
        this._model[name] = shadow[name];
        changed.push(name);
      }
      if (initialize) {
        const missing = Array.from(this._bindings.keys()).filter((n) => this._model[n] === undefined);
        if (missing.length) {
          console.warn('[DynaReactive] variables used in the HTML but not defined by the model: ' + missing.join(', '));
        }
      }
      // On init, also refresh views for variables that update() did not touch.
      this._apply(initialize ? Array.from(this._bindings.keys()) : changed);
    }

    _apply(names) {
      const done = new Set();
      for (const name of names) {
        const bindings = this._bindings.get(name);
        if (!bindings) continue;
        for (const b of bindings) {
          if (done.has(b)) continue;
          done.add(b);
          try { b.render(); } catch (err) { console.error('[DynaReactive] render error', err); }
        }
      }
      if (names.length) this._subscribers.forEach((fn) => fn(names, this));
    }

    _bind(varNames, render) {
      const binding = { render };
      for (const name of varNames) {
        if (!this._bindings.has(name)) this._bindings.set(name, []);
        this._bindings.get(name).push(binding);
      }
    }

    _values(varNames) {
      return varNames.map((n) => this._model[n]);
    }

    _scan() {
      const elements = this.element.querySelectorAll('[data-var], [class]');
      for (const el of elements) {
        const varAttr = (el.getAttribute('data-var') || '').trim();
        const varNames = varAttr ? varAttr.split(/\s+/) : null;

        const views = [];
        const seen = new Set();
        // Copy classList: controls add classes (e.g. dr-number) while we iterate,
        // and an element may carry both a legacy and a new alias of one control.
        for (const className of Array.from(el.classList)) {
          const Def = DynaReactive.classes[className];
          if (!Def || seen.has(Def)) continue;
          seen.add(Def);
          const view = construct(Def, [el, optionsFor(el), this].concat(varNames || []));
          views.push(view);
          this._controls.push(view);
        }
        if (!varNames) continue;

        const updatable = views.filter((v) => typeof v.update === 'function');
        if (updatable.length) {
          for (const view of updatable) {
            this._bind(varNames, () => view.update(el, ...this._values(varNames)));
          }
        } else {
          // Plain display: inject a span with the formatted value.
          const formatter = this._formatterFor(el, varNames);
          let span = null;
          this._bind(varNames, () => {
            if (!span) {
              span = document.createElement('span');
              span.className = 'dr-value';
              el.insertBefore(span, el.firstChild);
            }
            span.textContent = formatter(this._model[varNames[0]]);
          });
        }
      }
    }

    _formatterFor(el, varNames) {
      const fmt = (el.getAttribute('data-format') || '').trim();
      const multi = varNames.length > 1;
      const values = () => this._values(varNames);

      if (fmt) {
        const [name, ...params] = fmt.split(/\s+/);
        const named = DynaReactive.formats[name];
        if (named) {
          return (value) => named(...(multi ? values() : [value]), ...params);
        }
        if (fmt.includes('%')) {
          return (value) => sprintf(fmt, ...(multi ? values() : [value]));
        }
        console.warn('[DynaReactive] unknown format: ' + fmt);
      }

      const step = num(el.getAttribute('data-step'), NaN);
      if (!isNaN(step) && step > 0) {
        const d = decimalsOf(step);
        return (value) => (typeof value === 'number' ? value.toFixed(d) : defaultFormat(value));
      }
      return defaultFormat;
    }
  }

  /** Classes may be ES classes / constructors, or Tangle-style prototype objects. */
  function construct(Def, args) {
    if (typeof Def === 'function') return new Def(...args);
    const view = Object.create(Def);
    if (typeof view.initialize === 'function') view.initialize(...args);
    return view;
  }

  DynaReactive.classes = {};
  DynaReactive.formats = {};
  DynaReactive.sprintf = sprintf;
  DynaReactive.showError = showError;
  DynaReactive.version = '1.0.0';

  // ────────────────────────────────────────────────────────────────────────
  // Controls
  // ────────────────────────────────────────────────────────────────────────

  /** Shared min/max/step parsing. Defaults match TangleKit (min 0, step 1). */
  function rangeOptions(options) {
    const min = num(options.min, 0);
    const max = num(options.max, Infinity);
    const step = Math.abs(num(options.step, 1)) || 1;
    return { min, max: Math.max(min, max), step, decimals: decimalsOf(step) };
  }

  /**
   * Drag a number horizontally to change it.
   * Options: data-min, data-max, data-step, data-format, data-sensitivity (px per step).
   */
  class AdjustableNumber {
    constructor(element, options, runtime, variable) {
      Object.assign(this, rangeOptions(options));
      this.element = element;
      this.runtime = runtime;
      this.variable = variable;
      this.sensitivity = num(options.sensitivity, NaN);

      element.classList.add('dr-number');
      element.tabIndex = element.tabIndex >= 0 ? element.tabIndex : 0;
      element.setAttribute('role', 'slider');
      element.setAttribute('aria-label', options.label || variable);
      if (isFinite(this.min)) element.setAttribute('aria-valuemin', String(this.min));
      if (isFinite(this.max)) element.setAttribute('aria-valuemax', String(this.max));
      element.setAttribute('data-dr-hint', '↔ arrastra · doble clic');

      this.valueEl = document.createElement('span');
      this.valueEl.className = 'dr-value';
      element.insertBefore(this.valueEl, element.firstChild);

      this._listeners = [];
      this._on(element, 'pointerdown', (e) => this._down(e));
      this._on(element, 'pointermove', (e) => this._move(e));
      this._on(element, 'pointerup', (e) => this._up(e));
      this._on(element, 'pointercancel', (e) => this._up(e));
      this._on(element, 'dblclick', (e) => { e.preventDefault(); this._edit(); });
      this._on(element, 'keydown', (e) => this._key(e));
    }

    _on(target, type, fn) {
      target.addEventListener(type, fn);
      this._listeners.push(() => target.removeEventListener(type, fn));
    }

    destroy() {
      this._listeners.forEach((off) => off());
    }

    /** Pixels of horizontal movement per step. */
    _pxPerStep() {
      if (!isNaN(this.sensitivity) && this.sensitivity > 0) return this.sensitivity;
      if (isFinite(this.max) && isFinite(this.min)) {
        const steps = (this.max - this.min) / this.step;
        // Full range reachable in ~400px, but never coarser than Tangle's 5px/step.
        return clamp(400 / steps, 0.25, 5);
      }
      return 5;
    }

    _set(value) {
      value = clamp(value, this.min, this.max);
      this.runtime.setValue(this.variable, roundTo(value, Math.max(this.decimals, 0)));
    }

    _snap(value) {
      return Math.round(value / this.step) * this.step;
    }

    _down(e) {
      if (e.button !== 0 || this.editor) return;
      e.preventDefault();
      this.element.focus({ preventScroll: true });
      this.element.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, start: Number(this.runtime.getValue(this.variable)) || 0, moved: false };
    }

    _move(e) {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      if (!this.drag.moved) {
        if (Math.abs(dx) < 3) return;
        this.drag.moved = true;
        this.element.classList.add('is-dragging', 'TKAdjustableNumberDown');
        document.documentElement.classList.add('dr-dragging');
      }
      const px = this._pxPerStep() * (e.shiftKey ? 5 : 1);
      this._set(this._snap(this.drag.start + (dx / px) * this.step));
    }

    _up(e) {
      if (!this.drag) return;
      if (this.element.hasPointerCapture(e.pointerId)) this.element.releasePointerCapture(e.pointerId);
      const moved = this.drag.moved;
      this.drag = null;
      this.element.classList.remove('is-dragging', 'TKAdjustableNumberDown');
      document.documentElement.classList.remove('dr-dragging');
      if (moved) this.runtime.flush();
    }

    _key(e) {
      if (this.editor) return;
      const current = Number(this.runtime.getValue(this.variable)) || 0;
      const big = this.step * 10;
      let next = null;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp':   next = current + (e.shiftKey ? big : this.step); break;
        case 'ArrowLeft':  case 'ArrowDown': next = current - (e.shiftKey ? big : this.step); break;
        case 'PageUp':   next = current + big; break;
        case 'PageDown': next = current - big; break;
        case 'Home': if (isFinite(this.min)) next = this.min; break;
        case 'End':  if (isFinite(this.max)) next = this.max; break;
        case 'Enter': case 'F2': e.preventDefault(); this._edit(); return;
        default: return;
      }
      if (next === null) return;
      e.preventDefault();
      this._set(this._snap(next));
    }

    /** Inline editor to type an exact value. */
    _edit() {
      if (this.editor) return;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'dr-editor';
      input.step = 'any';
      if (isFinite(this.min)) input.min = String(this.min);
      if (isFinite(this.max)) input.max = String(this.max);
      input.value = String(this.runtime.getValue(this.variable));
      input.style.width = Math.max(4, this.valueEl.textContent.length + 2) + 'ch';
      this.editor = input;
      this.valueEl.hidden = true;
      this.element.appendChild(input);
      input.focus();
      input.select();

      let closed = false;
      const close = (commit) => {
        if (closed) return;
        closed = true;
        const v = parseFloat(input.value);
        input.remove();
        this.editor = null;
        this.valueEl.hidden = false;
        // Typed values are clamped but not snapped, so exact values are possible.
        if (commit && !isNaN(v)) this.runtime.setValue(this.variable, clamp(v, this.min, this.max));
        this.element.focus({ preventScroll: true });
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') close(true);
        if (e.key === 'Escape') close(false);
      });
      input.addEventListener('blur', () => close(true));
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    update(element, value) {
      const unbound = value === undefined;
      element.classList.toggle('dr-unbound', unbound);
      if (unbound) {
        this.valueEl.textContent = '?';
        element.setAttribute('data-dr-hint', '"' + this.variable + '" no está definida en el modelo');
        element.removeAttribute('aria-valuenow');
        return;
      }
      element.setAttribute('data-dr-hint', '↔ arrastra · doble clic');
      this.valueEl.textContent = this.runtime.format(element, value, [this.variable]);
      element.setAttribute('aria-valuenow', String(value));
      if (isFinite(this.min) && isFinite(this.max) && this.max > this.min) {
        const pct = clamp(((value - this.min) / (this.max - this.min)) * 100, 0, 100);
        element.style.setProperty('--dr-fill', pct.toFixed(1) + '%');
      }
    }
  }

  /** Native range slider. Options: data-min, data-max, data-step, data-show-value. */
  class Slider {
    constructor(element, options, runtime, variable) {
      const { min, max, step } = rangeOptions(options);
      this.runtime = runtime;
      this.variable = variable;
      element.classList.add('dr-slider');

      this.input = document.createElement('input');
      this.input.type = 'range';
      this.input.min = String(min);
      this.input.max = String(isFinite(max) ? max : min + 100 * step);
      this.input.step = String(step);
      this.input.setAttribute('aria-label', options.label || variable);
      this.input.addEventListener('input', () => runtime.setValue(variable, parseFloat(this.input.value)));
      this.input.addEventListener('change', () => runtime.flush());
      element.appendChild(this.input);

      if (options['show-value'] !== 'false') {
        this.output = document.createElement('output');
        this.output.className = 'dr-value';
        element.appendChild(this.output);
      }
    }

    update(element, value) {
      this.input.value = String(value);
      if (this.output) this.output.textContent = this.runtime.format(element, value, [this.variable]);
    }
  }

  /** Numeric text field. Options: data-min, data-max, data-step, data-size. */
  class NumberField {
    constructor(element, options, runtime, variable) {
      const { min, max } = rangeOptions(options);
      element.classList.add('dr-input');
      this.input = document.createElement('input');
      this.input.type = 'number';
      this.input.step = options.step || 'any';
      if (options.min !== undefined) this.input.min = String(min);
      if (isFinite(max)) this.input.max = String(max);
      this.input.style.width = (parseInt(options.size, 10) || 6) + 'ch';
      this.input.setAttribute('aria-label', options.label || variable);
      this.input.addEventListener('input', () => {
        const v = parseFloat(this.input.value);
        if (!isNaN(v)) runtime.setValue(variable, v);
      });
      element.appendChild(this.input);
    }

    update(element, value) {
      if (document.activeElement !== this.input) this.input.value = String(value);
    }
  }

  /** Click (or Enter/Space) to toggle a boolean / 0-1 variable. */
  class Toggle {
    constructor(element, options, runtime, variable) {
      element.classList.add('dr-toggle');
      element.tabIndex = 0;
      element.setAttribute('role', 'switch');
      const toggle = () => {
        const v = runtime.getValue(variable);
        runtime.setValue(variable, typeof v === 'number' ? (v ? 0 : 1) : !v);
      };
      element.addEventListener('click', toggle);
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    update(element, value) {
      element.classList.toggle('is-on', Boolean(value));
      element.setAttribute('aria-checked', String(Boolean(value)));
    }
  }

  /** Show the element only when the variable is truthy (data-invert="true" to negate). */
  class If {
    constructor(element, options) {
      this.invert = options.invert === 'true';
    }

    update(element, value) {
      element.hidden = this.invert ? Boolean(value) : !value;
    }
  }

  /** Show only the child whose index equals the variable's value. */
  class Switch {
    update(element, value) {
      const index = typeof value === 'boolean' ? (value ? 1 : 0) : Math.round(Number(value)) || 0;
      Array.from(element.children).forEach((child, i) => { child.hidden = i !== index; });
    }
  }

  /** Two children: first shown when value >= 0, second when value < 0. */
  class SwitchPositiveNegative {
    update(element, value) {
      const children = element.children;
      if (children[0]) children[0].hidden = value < 0;
      if (children[1]) children[1].hidden = !(value < 0);
    }
  }

  const register = (Def, ...names) => names.forEach((n) => { DynaReactive.classes[n] = Def; });
  register(AdjustableNumber, 'dr-number', 'TKAdjustableNumber');
  register(Slider, 'dr-slider');
  register(NumberField, 'dr-input', 'TKNumberField');
  register(Toggle, 'dr-toggle', 'TKToggle');
  register(If, 'dr-if', 'TKIf');
  register(Switch, 'dr-switch', 'TKSwitch');
  register(SwitchPositiveNegative, 'TKSwitchPositiveNegative');

  // ────────────────────────────────────────────────────────────────────────
  // Named formats (data-format="percent", data-format="fixed 2", …)
  // ────────────────────────────────────────────────────────────────────────

  const precision = (value, p) => {
    if (Math.abs(value) >= 100) p--;
    if (Math.abs(value) >= 10) p--;
    return Number(value).toFixed(Math.max(p, 0));
  };

  Object.assign(DynaReactive.formats, {
    default: defaultFormat,
    fixed: (v, d = 2) => Number(v).toFixed(parseInt(d, 10)),
    sig: (v, p = 4) => String(Number(Number(v).toPrecision(parseInt(p, 10)))),
    int: (v) => String(Math.round(v)),
    percent: (v, d = 0) => (100 * v).toFixed(parseInt(d, 10)) + '%',
    thousands: (v, d = 0) => Number(v).toLocaleString(undefined, { maximumFractionDigits: parseInt(d, 10) }),
    // TangleKit legacy formats
    p3: (v) => precision(v, 3),
    neg_p3: (v) => precision(-v, 3),
    p2: (v) => precision(v, 2),
    e6: (v) => String(Math.round(v * 1e-6)),
    abs_e6: (v) => String(Math.round(Math.abs(v) * 1e-6)),
    dollars: (v) => '$' + Math.round(v),
    free: (v) => (v ? '$' + Math.round(v) : 'free'),
  });

  global.DynaReactive = DynaReactive;
  // Backwards compatibility with code written for Tangle.js.
  global.Tangle = DynaReactive;
})(window);
