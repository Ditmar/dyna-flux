/**
 * DynaDashboard — renders the results panel of a DynaFlux model.
 *
 * The panel is described by a JSON spec (built with the visual editor), not HTML:
 *
 *   {
 *     version: 1,
 *     controls: [{ id, var, label, min, max, step, kind: 'number' | 'slider' }],
 *     widgets:  [
 *       { id, type: 'chart', title, x, series: [..], chartType: 'line'|'area'|'scatter'|'3d', size },
 *       { id, type: 'table', title, columns: [..], every, size },
 *       { id, type: 'kpi',   title, var, format, size },
 *       { id, type: 'text',  title, text, size }
 *     ]
 *   }
 *
 * Simulation data is recorded while the model's update() loop runs:
 *   dashboard.begin()        → before update()
 *   dashboard.record(this)   → injected at the start of every loop iteration
 *   dashboard.end(this)      → after update(): records the final state and renders
 *
 * Controls and KPI values are bound by DynaReactive (data-var), so this file
 * must be loaded after dyna-reactive.js.
 */
(function (global) {
  'use strict';

  const ROW_HEIGHT = 28;
  const TABLE_HEIGHT = 320;
  const OVERSCAN = 8;
  const COLORWAY = ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ca8a04', '#db2777'];

  const h = (tag, attrs, ...children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'className') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children) if (c !== null && c !== undefined) el.append(c);
    return el;
  };

  const formatNumber = (v) => {
    if (v === null || v === undefined || typeof v !== 'number') return v === null || v === undefined ? '' : String(v);
    if (!isFinite(v)) return String(v);
    if (Number.isInteger(v)) return String(v);
    return String(Number(v.toPrecision(6)));
  };

  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

  // ──────────────────────────────────────────────────────────────────────
  // Downsampling for charts
  //
  // Models with a small dt produce hundreds of thousands of points; drawing
  // them all takes Plotly ~1 s per update, which freezes the page while a
  // control is dragged. A chart a few hundred pixels wide cannot show more
  // than a few thousand points anyway, so charts draw a reduced set while
  // tables / CSV keep every simulation step.
  // ──────────────────────────────────────────────────────────────────────

  const MAX_POINTS_2D = 3000;
  const MAX_POINTS_3D = 6000;

  const isNum = (v) => typeof v === 'number' && isFinite(v);

  /**
   * Largest-Triangle-Three-Buckets: picks `threshold` indices that preserve the
   * visual shape of the line (peaks and valleys are kept).
   */
  function lttb(X, Y, threshold) {
    const n = Y.length;
    if (threshold >= n || threshold < 3) return null;
    const idx = new Array(threshold);
    const every = (n - 2) / (threshold - 2);
    let a = 0;
    idx[0] = 0;
    for (let i = 0; i < threshold - 2; i++) {
      const avgStart = Math.floor((i + 1) * every) + 1;
      const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
      let avgX = 0, avgY = 0;
      for (let j = avgStart; j < avgEnd; j++) { avgX += X[j]; avgY += Y[j]; }
      const len = Math.max(1, avgEnd - avgStart);
      avgX /= len; avgY /= len;

      const rangeStart = Math.floor(i * every) + 1;
      const rangeEnd = Math.floor((i + 1) * every) + 1;
      const ax = X[a], ay = Y[a];
      let maxArea = -1, next = rangeStart;
      for (let j = rangeStart; j < rangeEnd; j++) {
        const area = Math.abs((ax - avgX) * (Y[j] - ay) - (ax - X[j]) * (avgY - ay));
        if (area > maxArea) { maxArea = area; next = j; }
      }
      idx[i + 1] = next;
      a = next;
    }
    idx[threshold - 1] = n - 1;
    return idx;
  }

  /** Evenly spaced indices (always keeps the first and the last point). */
  function strideIndices(n, max) {
    if (n <= max) return null;
    const idx = [];
    const step = (n - 1) / (max - 1);
    for (let i = 0; i < max; i++) idx.push(Math.round(i * step));
    return idx;
  }

  const pick = (arr, idx) => (idx ? idx.map((i) => arr[i]) : arr);

  /** Reduce an (x, y) line to at most MAX_POINTS_2D points. */
  function downsample2D(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n <= MAX_POINTS_2D) return { x: xs, y: ys };
    let clean = true;
    for (let i = 0; i < n; i++) if (!isNum(xs[i]) || !isNum(ys[i])) { clean = false; break; }
    const idx = clean ? lttb(xs, ys, MAX_POINTS_2D) : strideIndices(n, MAX_POINTS_2D);
    return { x: pick(xs, idx), y: pick(ys, idx) };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Virtualized table: only the visible rows exist in the DOM, so tables
  // with hundreds of thousands of rows scroll smoothly without breaking.
  // ──────────────────────────────────────────────────────────────────────

  class VirtualTable {
    constructor(columns) {
      this.columns = columns;
      this.data = {};
      this.length = 0;
      this.indexMap = null; // row → source index (when sampling with `every`)

      const template = `repeat(${columns.length}, minmax(96px, 1fr))`;
      this.header = h('div', { className: 'dd-table-row dd-table-header', role: 'row' },
        ...columns.map((c) => h('div', { className: 'dd-table-cell', role: 'columnheader', title: c, text: c })));
      this.rows = h('div', { className: 'dd-table-rows', role: 'rowgroup' });
      this.spacer = h('div', { className: 'dd-table-spacer' }, this.rows);
      this.viewport = h('div', { className: 'dd-table-viewport', role: 'table', tabindex: '0' }, this.header, this.spacer);
      this.viewport.style.setProperty('--dd-cols', template);
      this.viewport.style.height = TABLE_HEIGHT + 'px';

      this._frame = 0;
      this.viewport.addEventListener('scroll', () => {
        if (!this._frame) this._frame = requestAnimationFrame(() => { this._frame = 0; this.render(); });
      }, { passive: true });
      this.element = this.viewport;
    }

    setData(data, length, every) {
      this.data = data;
      const step = Math.max(1, Math.floor(every || 1));
      if (step > 1) {
        // Keep the first row, every Nth row, and always the final state.
        const idx = [];
        for (let i = 0; i < length; i += step) idx.push(i);
        if (length && idx[idx.length - 1] !== length - 1) idx.push(length - 1);
        this.indexMap = idx;
        this.length = idx.length;
      } else {
        this.indexMap = null;
        this.length = length;
      }
      this.spacer.style.height = this.length * ROW_HEIGHT + 'px';
      this.render();
    }

    render() {
      const top = Math.max(0, this.viewport.scrollTop - this.header.offsetHeight);
      const visible = Math.ceil(this.viewport.clientHeight / ROW_HEIGHT);
      const start = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN);
      const end = Math.min(this.length, start + visible + OVERSCAN * 2);

      const cols = this.columns.map((c) => this.data[c] || []);
      const parts = [];
      for (let r = start; r < end; r++) {
        const i = this.indexMap ? this.indexMap[r] : r;
        parts.push('<div class="dd-table-row' + (r % 2 ? ' is-odd' : '') + '" role="row">');
        for (const col of cols) {
          parts.push('<div class="dd-table-cell" role="cell">' + escapeHtml(formatNumber(col[i])) + '</div>');
        }
        parts.push('</div>');
      }
      this.rows.style.transform = 'translateY(' + start * ROW_HEIGHT + 'px)';
      this.rows.innerHTML = parts.join('');
    }

    toCSV() {
      const lines = [this.columns.join(',')];
      for (let r = 0; r < this.length; r++) {
        const i = this.indexMap ? this.indexMap[r] : r;
        lines.push(this.columns.map((c) => formatNumber((this.data[c] || [])[i])).join(','));
      }
      return lines.join('\n');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Dashboard
  // ──────────────────────────────────────────────────────────────────────

  class DynaDashboard {
    constructor(root, spec) {
      this.root = root;
      this.spec = {
        controls: Array.isArray(spec && spec.controls) ? spec.controls : [],
        widgets: Array.isArray(spec && spec.widgets) ? spec.widgets : [],
      };
      this.data = {};
      this.length = 0;
      this.views = []; // { widget, render() }

      // Variables that need a time series (charts and tables).
      const vars = [];
      for (const w of this.spec.widgets) {
        if (w.type === 'chart') vars.push(w.x || 'time', ...(w.series || []));
        if (w.type === 'table') vars.push(...(w.columns || []));
      }
      this.vars = unique(vars);

      this._build();
    }

    // ── Recording API (called from the model) ─────────────────────────

    begin() {
      this.data = {};
      for (const v of this.vars) this.data[v] = [];
      this.length = 0;
    }

    record(state) {
      for (const v of this.vars) {
        const value = state[v];
        this.data[v].push(typeof value === 'number' ? value : value === undefined ? null : Number(value));
      }
      this.length++;
    }

    end(state) {
      this.record(state); // final state (t = finalTime)
      this.render();
    }

    // ── Rendering ─────────────────────────────────────────────────────

    render() {
      const undefinedVars = new Set(this.vars.filter((v) => this.data[v].every((x) => x === null)));
      for (const view of this.views) {
        try {
          view.render(undefinedVars);
        } catch (err) {
          console.error('[DynaDashboard] render error', err);
        }
      }
    }

    _build() {
      this.root.classList.add('dd-root');
      this.root.textContent = '';

      if (this.spec.controls.length) {
        const bar = h('section', { className: 'dd-controls', 'aria-label': 'Parámetros' });
        for (const c of this.spec.controls) bar.append(this._control(c));
        this.root.append(bar);
      }

      const grid = h('div', { className: 'dd-grid' });
      for (const w of this.spec.widgets) {
        const card = this._card(w);
        if (card) grid.append(card);
      }
      if (!this.spec.widgets.length) {
        grid.append(h('div', { className: 'dd-empty' },
          h('strong', { text: 'Panel vacío' }),
          h('span', { text: 'Agrega gráficos, tablas e indicadores desde el diseñador del panel.' })));
      }
      this.root.append(grid);
    }

    _control(c) {
      const attrs = {
        'data-var': c.var,
        'data-min': c.min,
        'data-max': c.max,
        'data-step': c.step,
        'data-label': c.label || c.var,
      };
      const input = c.kind === 'slider'
        ? h('span', Object.assign({ className: 'dr-slider' }, attrs))
        : h('span', Object.assign({ className: 'dr-number' }, attrs));
      return h('div', { className: 'dd-control' + (c.kind === 'slider' ? ' is-slider' : '') },
        h('span', { className: 'dd-control-label', text: c.label || c.var }),
        input);
    }

    _card(w) {
      const title = h('h3', { className: 'dd-card-title', text: w.title || '' });
      const actions = h('div', { className: 'dd-card-actions' });
      const warn = h('div', { className: 'dd-warn', hidden: true });
      const body = h('div', { className: 'dd-card-body' });
      const card = h('article', { className: 'dd-card dd-' + w.type + (w.size === 'wide' ? ' is-wide' : '') },
        h('header', { className: 'dd-card-head' }, title, actions), warn, body);

      const showMissing = (undefinedVars, used) => {
        const missing = used.filter((v) => undefinedVars.has(v));
        warn.hidden = !missing.length;
        warn.textContent = missing.length ? 'Sin datos para: ' + missing.join(', ') + ' (¿está definida con this.?)' : '';
      };

      if (w.type === 'chart') {
        const plot = h('div', { className: 'dd-plot' });
        body.append(plot);
        const x = w.x || 'time';
        const series = (w.series || []).filter(Boolean);
        this.views.push({
          render: (undefinedVars) => {
            showMissing(undefinedVars, [x, ...series]);
            this._renderChart(plot, w, x, series);
          },
        });
      } else if (w.type === 'table') {
        const columns = unique(w.columns || []);
        const table = new VirtualTable(columns);
        const count = h('span', { className: 'dd-badge' });
        actions.append(count, h('button', {
          type: 'button', className: 'dd-btn', title: 'Descargar CSV',
          onClick: () => download((w.title || 'datos').replace(/[^\w-]+/g, '_') + '.csv', table.toCSV()),
        }, 'CSV'));
        body.append(table.element);
        this.views.push({
          render: (undefinedVars) => {
            showMissing(undefinedVars, columns);
            table.setData(this.data, this.length, w.every);
            count.textContent = table.length.toLocaleString() + ' filas';
          },
        });
      } else if (w.type === 'kpi') {
        body.append(
          h('div', { className: 'dd-kpi-value' }, h('span', { 'data-var': w.var, 'data-format': w.format || undefined })),
          h('div', { className: 'dd-kpi-caption', text: w.var ? w.var + ' · valor final' : 'Elige una variable' }));
      } else if (w.type === 'text') {
        body.append(h('p', { className: 'dd-text', text: w.text || '' }));
      } else {
        return null;
      }
      return card;
    }

    _renderChart(el, w, x, series) {
      if (typeof Plotly === 'undefined') return;
      const xs = this.data[x] || [];
      const layout = {
        autosize: true,
        height: w.chartType === '3d' ? 380 : 300,
        margin: { l: 56, r: 16, t: 12, b: 44 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'system-ui, -apple-system, Segoe UI, sans-serif', size: 11, color: '#374151' },
        colorway: COLORWAY,
        showlegend: series.length > 1,
        legend: { orientation: 'h', x: 0, y: 1.12 },
        // Keeps zoom / pan / 3D camera between re-simulations.
        uirevision: w.id || 'chart',
        xaxis: { title: { text: x }, gridcolor: '#eef0f3', zeroline: false },
        yaxis: { gridcolor: '#eef0f3', zeroline: false, title: series.length === 1 ? { text: series[0] } : undefined },
      };
      let traces;
      if (w.chartType === '3d') {
        const [y, z] = series;
        const idx = strideIndices(xs.length, MAX_POINTS_3D);
        traces = [{
          type: 'scatter3d', mode: 'lines',
          x: pick(xs, idx), y: pick(this.data[y] || [], idx), z: pick(this.data[z] || [], idx),
          line: { width: 4, color: COLORWAY[0] },
        }];
        layout.margin = { l: 0, r: 0, t: 0, b: 0 };
        layout.scene = { xaxis: { title: { text: x } }, yaxis: { title: { text: y || '' } }, zaxis: { title: { text: z || '' } } };
        layout.showlegend = false;
      } else {
        traces = series.map((s) => {
          const pts = downsample2D(xs, this.data[s] || []);
          return {
            type: 'scatter',
            mode: w.chartType === 'scatter' ? 'markers' : 'lines',
            fill: w.chartType === 'area' ? 'tozeroy' : undefined,
            marker: { size: 4 },
            line: { width: 2 },
            name: s,
            x: pts.x,
            y: pts.y,
          };
        });
      }
      Plotly.react(el, traces, layout, {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      });
    }

    /**
     * Wrap a model so every update() run is recorded and rendered.
     * The model's loop must call `__DF.record(this)` (injected by the editor).
     */
    attach(model) {
      const dashboard = this;
      const update = model.update;
      return Object.assign({}, model, {
        update: function () {
          dashboard.begin();
          if (typeof update === 'function') update.call(this);
          dashboard.end(this);
        },
      });
    }
  }

  DynaDashboard.VirtualTable = VirtualTable;
  global.DynaDashboard = DynaDashboard;
})(window);
