# DynaReactive

Runtime reactivo del panel de simulación (`public/lib/dyna-reactive/`).
Sustituye a Tangle.js + TangleKit + MooTools y mantiene su API, así que los
proyectos existentes funcionan sin cambios (`window.Tangle` es un alias).

## Modelo

```js
const model = {
  initialize: function () { this.k = 0.5; this.finalTime = 100; }, // una vez
  update: function () { /* simulación; se re-ejecuta tras cada cambio */ }
};
```

`update()` se ejecuta como máximo una vez por frame mientras se arrastra un control.
Si lanza un error, se muestra un aviso en el panel.

## Controles (atributo `class` + `data-var`)

| Clase | Alias antiguo | Qué hace | Opciones |
| --- | --- | --- | --- |
| `dr-number` | `TKAdjustableNumber` | Número arrastrable. Teclado: ← → (Shift ×10), PgUp/PgDn, Home/End. Doble clic o Enter para escribir el valor. Shift al arrastrar = ajuste fino. | `data-min` (0), `data-max`, `data-step` (1), `data-sensitivity` (px por paso), `data-format`, `data-label` |
| `dr-slider` | — | Slider nativo `<input type=range>` con valor | `data-min`, `data-max`, `data-step`, `data-show-value="false"` |
| `dr-input` | `TKNumberField` | Campo numérico | `data-min`, `data-max`, `data-step`, `data-size` |
| `dr-toggle` | `TKToggle` | Alterna booleano / 0-1 al hacer clic | — |
| `dr-if` | `TKIf` | Muestra el elemento si la variable es verdadera | `data-invert="true"` |
| `dr-switch` | `TKSwitch` | Muestra solo el hijo con índice = valor | — |

Un elemento con `data-var` y sin clase de control solo muestra el valor.

## Formatos (`data-format`)

- printf: `%.2f`, `%d`, `%e`, `%5.1f%%`…
- con nombre: `fixed 2`, `sig 4`, `int`, `percent 1`, `thousands`, y los de TangleKit (`p2`, `p3`, `dollars`…).
- Por defecto: decimales según `data-step`; si no hay, hasta 6 cifras significativas.

```html
<p id="example">
  Tiempo final <span data-var="finalTime" class="dr-number" data-min="0" data-max="300" data-step="1"></span>
  Tasa <span data-var="k" class="dr-slider" data-min="0" data-max="1" data-step="0.01"></span>
  Población final: <span data-var="x" data-format="%.1f"></span>
</p>
```

## API JavaScript

`window.dynaflux` es la instancia activa: `getValue(name)`, `setValue(name, v)`,
`setValues({...}, { sync })`, `flush()`, `subscribe(fn)`, `destroy()`.
Se pueden registrar controles propios en `DynaReactive.classes` y formatos en `DynaReactive.formats`.
