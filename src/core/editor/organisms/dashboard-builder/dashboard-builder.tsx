import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ChartLine, ChevronDown, ChevronUp, Gauge, Plus, RectangleHorizontal, SlidersHorizontal,
  Square, StickyNote, Table2, Trash2, WandSparkles, X,
} from 'lucide-react';
import styles from './dashboard-builder.module.scss';
import {
  autoDashboard, createControl, createWidget, detectModelVars, detectParameters,
} from '../../dashboard/dashboard';
import type {
  ChartType, ControlSpec, DashboardSpec, Widget, WidgetType,
} from '../../dashboard/dashboard';

interface DashboardBuilderProps {
  value: DashboardSpec;
  onChange: (spec: DashboardSpec) => void;
  modelCode: string;
}

const WIDGET_META: Record<WidgetType, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  chart: { label: 'Gráfico', Icon: ChartLine },
  table: { label: 'Tabla', Icon: Table2 },
  kpi:   { label: 'Indicador', Icon: Gauge },
  text:  { label: 'Nota', Icon: StickyNote },
};

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'line', label: 'Líneas' },
  { value: 'area', label: 'Área' },
  { value: 'scatter', label: 'Puntos' },
  { value: '3d', label: 'Trayectoria 3D' },
];

// ── Small inputs ───────────────────────────────────────────────────────────

/** Number input that lets the user type intermediate values ("-", "0.") freely. */
const NumField = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) => {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(value)); }, [value, focused]);
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
};

const VarField = ({ value, onChange, listId, label, placeholder = 'variable' }: {
  value: string; onChange: (v: string) => void; listId: string; label?: string; placeholder?: string;
}) => (
  <label className={styles.field}>
    {label && <span>{label}</span>}
    <input
      className={`${styles.input} ${styles.mono}`}
      list={listId}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value.trim())}
    />
  </label>
);

/** Chips with remove buttons + an input (with suggestions) to add more. */
const VarChips = ({ values, onChange, listId, label }: {
  values: string[]; onChange: (v: string[]) => void; listId: string; label: string;
}) => {
  const [draft, setDraft] = useState('');
  const add = (v: string) => {
    const name = v.trim();
    if (name && !values.includes(name)) onChange([...values, name]);
    setDraft('');
  };
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <div className={styles.chips}>
        {values.map((v) => (
          <span key={v} className={styles.chip}>
            {v}
            <button type="button" aria-label={`Quitar ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className={`${styles.chipInput} ${styles.mono}`}
          list={listId}
          value={draft}
          placeholder="+ variable"
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            // Picking an option from the datalist fires a single change with the full value.
            if ((e.nativeEvent as InputEvent).inputType === undefined || (e.nativeEvent as InputEvent).inputType === 'insertReplacementText') add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
            if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
    </div>
  );
};

// ── Builder ────────────────────────────────────────────────────────────────

const DashboardBuilder: React.FC<DashboardBuilderProps> = ({ value, onChange, modelCode }) => {
  const listId = useId();
  const vars = useMemo(() => {
    const found = detectModelVars(modelCode);
    return found.includes('time') ? found : ['time', ...found];
  }, [modelCode]);
  const params = useMemo(() => detectParameters(modelCode), [modelCode]);
  const knownVars = useMemo(() => new Set(vars), [vars]);

  const setControls = (controls: ControlSpec[]) => onChange({ ...value, controls });
  const setWidgets = (widgets: Widget[]) => onChange({ ...value, widgets });

  const updateControl = (id: string, patch: Partial<ControlSpec>) =>
    setControls(value.controls.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const updateWidget = (id: string, patch: Partial<Widget>) =>
    setWidgets(value.widgets.map((w) => (w.id === id ? ({ ...w, ...patch } as Widget) : w)));

  const moveWidget = (index: number, delta: number) => {
    const next = [...value.widgets];
    const [item] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item);
    setWidgets(next);
  };

  const addControl = () => {
    const used = new Set(value.controls.map((c) => c.var));
    const p = params.find((x) => !used.has(x.name));
    setControls([...value.controls, p ? createControl(p.name, p.value) : createControl('')]);
  };

  const addWidget = (type: WidgetType) => {
    const candidates = vars.filter((v) => v !== 'time' && !params.some((p) => p.name === v));
    setWidgets([...value.widgets, createWidget(type, candidates)]);
  };

  const onControlVarChange = (c: ControlSpec, v: string) => {
    // Keep a custom label; otherwise the label follows the variable name.
    const label = !c.label || c.label === c.var ? v : c.label;
    // Picking a known parameter suggests bounds from its initial value.
    const p = params.find((x) => x.name === v);
    const bounds = p && v !== c.var ? createControl(v, p.value) : null;
    updateControl(c.id, bounds ? { var: v, label, min: bounds.min, max: bounds.max, step: bounds.step } : { var: v, label });
  };

  const autoGenerate = () => {
    const hasContent = value.controls.length || value.widgets.length;
    if (hasContent && !confirm('¿Reemplazar el panel actual por uno generado a partir del código del modelo?')) return;
    onChange(autoDashboard(modelCode));
  };

  const unknown = (v: string) => !!v && !knownVars.has(v);

  return (
    <div className={styles.builder}>
      <datalist id={listId}>
        {vars.map((v) => <option key={v} value={v} />)}
      </datalist>

      <header className={styles.top}>
        <div>
          <h2 className={styles.title}>Panel de resultados</h2>
          <p className={styles.subtitle}>Diseña los controles, gráficos y tablas que se muestran al simular.</p>
        </div>
        <button type="button" className={styles.ghostBtn} onClick={autoGenerate} title="Crear el panel a partir del código del modelo">
          <WandSparkles size={14} /> Auto-generar
        </button>
      </header>

      {/* ── Controls ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3><SlidersHorizontal size={13} /> Controles <span className={styles.count}>{value.controls.length}</span></h3>
          <button type="button" className={styles.addBtn} onClick={addControl}><Plus size={13} /> Control</button>
        </div>
        {value.controls.length === 0 && (
          <p className={styles.empty}>Sin controles. Añade parámetros ajustables como tasas o tiempo final.</p>
        )}
        <div className={styles.controlList}>
          {value.controls.map((c) => (
            <div key={c.id} className={styles.controlRow}>
              <VarField value={c.var} onChange={(v) => onControlVarChange(c, v)} listId={listId} label="Variable" />
              <label className={`${styles.field} ${styles.grow}`}>
                <span>Etiqueta</span>
                <input className={styles.input} value={c.label} onChange={(e) => updateControl(c.id, { label: e.target.value })} />
              </label>
              <NumField label="Mín" value={c.min} onChange={(n) => updateControl(c.id, { min: n })} />
              <NumField label="Máx" value={c.max} onChange={(n) => updateControl(c.id, { max: n })} />
              <NumField label="Paso" value={c.step} onChange={(n) => n > 0 && updateControl(c.id, { step: n })} />
              <div className={styles.field}>
                <span>Tipo</span>
                <div className={styles.segmented}>
                  <button type="button" className={c.kind === 'number' ? styles.on : ''} onClick={() => updateControl(c.id, { kind: 'number' })}>Número</button>
                  <button type="button" className={c.kind === 'slider' ? styles.on : ''} onClick={() => updateControl(c.id, { kind: 'slider' })}>Slider</button>
                </div>
              </div>
              <button type="button" className={styles.iconBtn} aria-label="Eliminar control" onClick={() => setControls(value.controls.filter((x) => x.id !== c.id))}>
                <Trash2 size={14} />
              </button>
              {unknown(c.var) && <p className={styles.warn}>“{c.var}” no aparece en el código del modelo.</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Widgets ── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h3><ChartLine size={13} /> Contenido <span className={styles.count}>{value.widgets.length}</span></h3>
          <div className={styles.addGroup}>
            {(Object.keys(WIDGET_META) as WidgetType[]).map((t) => {
              const { label, Icon } = WIDGET_META[t];
              return (
                <button key={t} type="button" className={styles.addBtn} onClick={() => addWidget(t)}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        </div>
        {value.widgets.length === 0 && (
          <p className={styles.empty}>Sin contenido. Añade un gráfico, una tabla o un indicador.</p>
        )}

        {value.widgets.map((w, i) => {
          const { label, Icon } = WIDGET_META[w.type];
          return (
            <article key={w.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.badge}><Icon size={12} /> {label}</span>
                <input
                  className={`${styles.input} ${styles.titleInput}`}
                  value={w.title}
                  placeholder="Título"
                  onChange={(e) => updateWidget(w.id, { title: e.target.value })}
                />
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${w.size === 'wide' ? styles.active : ''}`}
                    title={w.size === 'wide' ? 'Ancho completo (clic para mitad)' : 'Mitad (clic para ancho completo)'}
                    onClick={() => updateWidget(w.id, { size: w.size === 'wide' ? 'normal' : 'wide' })}
                  >
                    {w.size === 'wide' ? <RectangleHorizontal size={14} /> : <Square size={13} />}
                  </button>
                  <button type="button" className={styles.iconBtn} aria-label="Subir" disabled={i === 0} onClick={() => moveWidget(i, -1)}><ChevronUp size={14} /></button>
                  <button type="button" className={styles.iconBtn} aria-label="Bajar" disabled={i === value.widgets.length - 1} onClick={() => moveWidget(i, 1)}><ChevronDown size={14} /></button>
                  <button type="button" className={styles.iconBtn} aria-label="Eliminar" onClick={() => setWidgets(value.widgets.filter((x) => x.id !== w.id))}><Trash2 size={14} /></button>
                </div>
              </div>

              <div className={styles.cardBody}>
                {w.type === 'chart' && (
                  <>
                    <label className={styles.field}>
                      <span>Tipo</span>
                      <select className={styles.input} value={w.chartType} onChange={(e) => updateWidget(w.id, { chartType: e.target.value as ChartType })}>
                        {CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    <VarField label="Eje X" value={w.x} onChange={(v) => updateWidget(w.id, { x: v })} listId={listId} />
                    {w.chartType === '3d' ? (
                      <>
                        <VarField label="Eje Y" value={w.series[0] || ''} onChange={(v) => updateWidget(w.id, { series: [v, w.series[1] || ''] })} listId={listId} />
                        <VarField label="Eje Z" value={w.series[1] || ''} onChange={(v) => updateWidget(w.id, { series: [w.series[0] || '', v] })} listId={listId} />
                      </>
                    ) : (
                      <VarChips label="Series (eje Y)" values={w.series} onChange={(s) => updateWidget(w.id, { series: s })} listId={listId} />
                    )}
                  </>
                )}

                {w.type === 'table' && (
                  <>
                    <VarChips label="Columnas" values={w.columns} onChange={(c) => updateWidget(w.id, { columns: c })} listId={listId} />
                    <label className={styles.field}>
                      <span>Mostrar</span>
                      <select className={styles.input} value={w.every} onChange={(e) => updateWidget(w.id, { every: Number(e.target.value) })}>
                        {[1, 2, 5, 10, 50, 100].map((n) => (
                          <option key={n} value={n}>{n === 1 ? 'Todos los pasos' : `1 de cada ${n} pasos`}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {w.type === 'kpi' && (
                  <>
                    <VarField label="Variable" value={w.var} onChange={(v) => updateWidget(w.id, { var: v })} listId={listId} />
                    <label className={styles.field}>
                      <span>Formato</span>
                      <select className={styles.input} value={w.format} onChange={(e) => updateWidget(w.id, { format: e.target.value })}>
                        <option value="">Automático</option>
                        <option value="int">Entero</option>
                        <option value="fixed 2">2 decimales</option>
                        <option value="percent 1">Porcentaje</option>
                        <option value="thousands">Miles (1,234)</option>
                        <option value="%.3e">Científico</option>
                      </select>
                    </label>
                  </>
                )}

                {w.type === 'text' && (
                  <label className={`${styles.field} ${styles.grow}`}>
                    <span>Texto</span>
                    <textarea className={styles.input} rows={3} value={w.text} onChange={(e) => updateWidget(w.id, { text: e.target.value })} />
                  </label>
                )}
              </div>

              {(() => {
                const used = w.type === 'chart' ? [w.x, ...w.series] : w.type === 'table' ? w.columns : w.type === 'kpi' ? [w.var] : [];
                const missing = used.filter(unknown);
                return missing.length ? <p className={styles.warn}>No aparecen en el modelo: {missing.join(', ')}</p> : null;
              })()}
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default DashboardBuilder;
