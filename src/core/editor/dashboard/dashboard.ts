// Results-panel ("dashboard") definition shared by the visual builder,
// the simulation iframe (public/lib/dyna-dashboard) and project storage.

export type WidgetSize = 'normal' | 'wide';
export type ControlKind = 'number' | 'slider';
export type ChartType = 'line' | 'area' | 'scatter' | '3d';

export interface ControlSpec {
  id: string;
  var: string;
  label: string;
  min: number;
  max: number;
  step: number;
  kind: ControlKind;
}

interface WidgetBase {
  id: string;
  title: string;
  size: WidgetSize;
}

export interface ChartWidget extends WidgetBase {
  type: 'chart';
  x: string;
  /** For 3D charts: [y, z]. */
  series: string[];
  chartType: ChartType;
}

export interface TableWidget extends WidgetBase {
  type: 'table';
  columns: string[];
  /** Show one row every N simulation steps (1 = all). */
  every: number;
}

export interface KpiWidget extends WidgetBase {
  type: 'kpi';
  var: string;
  format: string;
}

export interface TextWidget extends WidgetBase {
  type: 'text';
  text: string;
}

export type Widget = ChartWidget | TableWidget | KpiWidget | TextWidget;
export type WidgetType = Widget['type'];

export interface DashboardSpec {
  version: 1;
  controls: ControlSpec[];
  widgets: Widget[];
}

export const emptyDashboard = (): DashboardSpec => ({ version: 1, controls: [], widgets: [] });

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

// ── Factories ──────────────────────────────────────────────────────────────

export const createControl = (v = '', value?: number): ControlSpec => {
  const b = sliderBounds(value);
  return { id: newId(), var: v, label: v, min: b.min, max: b.max, step: b.step, kind: 'number' };
};

export const createWidget = (type: WidgetType, vars: string[] = []): Widget => {
  const id = newId();
  switch (type) {
    case 'chart':
      return { id, type, title: 'Gráfico', size: 'normal', x: 'time', series: vars.slice(0, 1), chartType: 'line' };
    case 'table':
      return { id, type, title: 'Tabla de datos', size: 'wide', columns: ['time', ...vars.slice(0, 3)], every: 1 };
    case 'kpi':
      return { id, type, title: vars[0] || 'Indicador', size: 'normal', var: vars[0] || '', format: '' };
    case 'text':
      return { id, type, title: 'Nota', size: 'normal', text: '' };
  }
};

// ── Validation ─────────────────────────────────────────────────────────────

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const nr = (v: unknown, d: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) ? n : d;
};
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []);
const size = (v: unknown): WidgetSize => (v === 'wide' ? 'wide' : 'normal');

/** Accepts anything (parsed JSON, a JSON string, null) and returns a valid spec. */
export function normalizeDashboard(raw: unknown): DashboardSpec {
  let data: any = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return emptyDashboard(); }
  }
  if (!data || typeof data !== 'object') return emptyDashboard();

  const controls: ControlSpec[] = (Array.isArray(data.controls) ? data.controls : [])
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => ({
      id: str(c.id) || newId(),
      var: str(c.var),
      label: str(c.label, str(c.var)),
      min: nr(c.min, 0),
      max: nr(c.max, 100),
      step: Math.abs(nr(c.step, 1)) || 1,
      kind: c.kind === 'slider' ? 'slider' : 'number',
    }));

  const widgets: Widget[] = [];
  for (const w of Array.isArray(data.widgets) ? data.widgets : []) {
    if (!w || typeof w !== 'object') continue;
    const base = { id: str(w.id) || newId(), title: str(w.title), size: size(w.size) };
    if (w.type === 'chart') {
      const ct = ['line', 'area', 'scatter', '3d'].includes(w.chartType) ? w.chartType : 'line';
      widgets.push({ ...base, type: 'chart', x: str(w.x, 'time') || 'time', series: strs(w.series), chartType: ct });
    } else if (w.type === 'table') {
      widgets.push({ ...base, type: 'table', columns: strs(w.columns), every: Math.max(1, Math.round(nr(w.every, 1))) });
    } else if (w.type === 'kpi') {
      widgets.push({ ...base, type: 'kpi', var: str(w.var), format: str(w.format) });
    } else if (w.type === 'text') {
      widgets.push({ ...base, type: 'text', text: str(w.text) });
    }
  }
  return { version: 1, controls, widgets };
}

// ── Legacy HTML → spec ─────────────────────────────────────────────────────

/**
 * Converts the hand-written HTML panels of older projects (TKAdjustableNumber
 * spans + <div class="plotly" data-plotly="[time, x]">) into a dashboard spec.
 */
export function dashboardFromLegacyHtml(html: string | null | undefined): DashboardSpec {
  const spec = emptyDashboard();
  if (!html || typeof DOMParser === 'undefined') return spec;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll<HTMLElement>('[data-var]').forEach((el) => {
    const v = (el.getAttribute('data-var') || '').trim().split(/\s+/)[0];
    if (!v) return;
    const isControl = /\b(TKAdjustableNumber|dr-number|dr-slider|TKNumberField|dr-input)\b/.test(el.className);
    if (isControl) {
      // Label = the text right before the span ("Final Time <span …>").
      let label = '';
      const prev = el.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        const lines = (prev.textContent || '').split('\n').map((s) => s.trim()).filter(Boolean);
        label = lines[lines.length - 1] || '';
      }
      spec.controls.push({
        id: newId(),
        var: v,
        label: label || v,
        min: nr(el.getAttribute('data-min'), 0),
        max: nr(el.getAttribute('data-max'), 100),
        step: Math.abs(nr(el.getAttribute('data-step'), 1)) || 1,
        kind: el.classList.contains('dr-slider') ? 'slider' : 'number',
      });
    } else if (!el.classList.contains('plotly')) {
      spec.widgets.push({ id: newId(), type: 'kpi', title: v, size: 'normal', var: v, format: el.getAttribute('data-format') || '' });
    }
  });

  doc.querySelectorAll<HTMLElement>('.plotly[data-plotly]').forEach((el) => {
    const groups = Array.from((el.getAttribute('data-plotly') || '').matchAll(/\[([^\]]+)\]/g))
      .map((m) => m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean))
      .filter((g) => g.length >= 2);
    if (!groups.length) return;
    const title = (el.id || 'Gráfico').replace(/_plot$/, '').replace(/[_-]+/g, ' ');
    const g3 = groups.find((g) => g.length >= 3);
    if (g3) {
      spec.widgets.push({ id: newId(), type: 'chart', title, size: 'normal', x: g3[0], series: [g3[1], g3[2]], chartType: '3d' });
    } else {
      spec.widgets.push({
        id: newId(), type: 'chart', title, size: 'normal',
        x: groups[0][0], series: Array.from(new Set(groups.map((g) => g[1]))), chartType: 'line',
      });
    }
  });
  return spec;
}

// ── Model analysis ─────────────────────────────────────────────────────────

const RESERVED = new Set(['initialize', 'update', 'constructor']);

/** Every `this.xxx` name used in the model code, in order of appearance. */
export function detectModelVars(code: string): string[] {
  const seen = new Set<string>();
  for (const m of code.matchAll(/this\.([A-Za-z_$][\w$]*)/g)) {
    if (!RESERVED.has(m[1])) seen.add(m[1]);
  }
  return Array.from(seen);
}

function functionBody(code: string, name: string): string {
  const header = code.match(new RegExp(name + '\\s*:\\s*(?:function\\s*\\([^)]*\\)|\\([^)]*\\)\\s*=>)\\s*\\{'));
  if (!header || header.index === undefined) return '';
  let depth = 1;
  const start = header.index + header[0].length;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(start, i);
  }
  return code.slice(start);
}

const SYSTEM_VARS = new Set(['time', 'dt', 'initTime', 'finalTime', 'step']);

/**
 * Numeric parameters assigned in initialize(): `this.k = 0.5;`
 * Variables recomputed inside the update() loop (e.g. `this.bx = 0; // computed`)
 * are placeholders, not parameters, so they are excluded.
 */
export function detectParameters(code: string): { name: string; value: number }[] {
  const body = functionBody(code, 'initialize');
  const computed = new Set(detectStateVars(code));
  const out: { name: string; value: number }[] = [];
  for (const m of body.matchAll(/this\.([A-Za-z_$][\w$]*)\s*=\s*(-?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*;/g)) {
    const name = m[1];
    if (SYSTEM_VARS.has(name) || computed.has(name) || out.some((p) => p.name === name)) continue;
    out.push({ name, value: parseFloat(m[2]) });
  }
  return out;
}

/** Variables that change inside the update() loop (stocks / computed values). */
export function detectStateVars(code: string): string[] {
  const body = functionBody(code, 'update');
  const loop = body.slice(Math.max(0, body.search(/for\s*\(/)));
  const seen = new Set<string>();
  for (const m of loop.matchAll(/this\.([A-Za-z_$][\w$]*)\s*(?:[-+*/]?=)(?!=)/g)) {
    if (!SYSTEM_VARS.has(m[1])) seen.add(m[1]);
  }
  return Array.from(seen);
}

/** Same heuristic the Forrester editor uses for slider bounds. */
export function sliderBounds(value?: number): { min: number; max: number; step: number } {
  if (value === undefined || !isFinite(value)) return { min: 0, max: 10, step: 0.1 };
  if (value === 0) return { min: -1, max: 1, step: 0.01 };
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const base = Math.pow(10, exp);
  const f = (3 * abs) / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  const r = (n: number) => Math.round(n * 1e8) / 1e8;
  const max = r(nice * base);
  const step = r(Math.pow(10, exp - 1));
  return value < 0 ? { min: -max, max: 0, step } : { min: 0, max, step };
}

/** Builds a sensible starting dashboard from the model code. */
export function autoDashboard(code: string): DashboardSpec {
  const params = detectParameters(code);
  const state = detectStateVars(code);
  const finalMatch = code.match(/this\.finalTime\s*=\s*(-?\d*\.?\d+)/);
  const finalTime = finalMatch ? parseFloat(finalMatch[1]) : 100;

  const controls: ControlSpec[] = [
    { ...createControl('finalTime', finalTime), label: 'Tiempo final', min: 0 },
    ...params.map((p) => createControl(p.name, p.value)),
  ];
  const widgets: Widget[] = state.map((v) => ({
    id: newId(), type: 'chart' as const, title: v.replace(/_/g, ' '), size: 'normal' as const,
    x: 'time', series: [v], chartType: 'line' as const,
  }));
  if (state.length) {
    widgets.push({ id: newId(), type: 'table', title: 'Datos de la simulación', size: 'wide', columns: ['time', ...state], every: 1 });
  }
  return { version: 1, controls, widgets };
}
