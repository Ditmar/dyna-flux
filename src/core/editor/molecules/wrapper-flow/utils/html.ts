import type { DashboardSpec } from '../../../dashboard/dashboard';

// JSON that is safe to embed inside a <script> tag: escape "<" (prevents
// "</script>" injection) and the U+2028/U+2029 line separators.
const BS = String.fromCharCode(92);
const scriptJson = (value: unknown) =>
    JSON.stringify(value)
        .split('<').join(BS + 'u003c')
        .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
        .split(String.fromCharCode(0x2029)).join(BS + 'u2029');

/**
 * Full document for the simulation iframe.
 * @param model  Model object literal (`{ initialize…, update… }`) with
 *               `__DF.record(this)` already injected inside the update loop.
 * @param spec   Results panel definition.
 */
const getSimulationDocument = (title: string, model: string, spec: DashboardSpec) => `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base target="_top">
    <title>${title}</title>
    <script src="https://cdn.plot.ly/plotly-3.0.0.min.js" charset="utf-8"></script>
    <link rel="stylesheet" href="./lib/dyna-reactive/dyna-reactive.css">
    <link rel="stylesheet" href="./lib/dyna-dashboard/dyna-dashboard.css">
    <script src="./lib/dyna-reactive/dyna-reactive.js"></script>
    <script src="./lib/dyna-dashboard/dyna-dashboard.js"></script>
    <script src="./lib/dynaflux-stdlib.js"></script>
</head>
<body>
    <main id="df-root"></main>
    <script>
        (function () {
            var root = document.getElementById('df-root');
            var dashboard = new DynaDashboard(root, ${scriptJson(spec)});
            window.__DF = dashboard;
            var model = ${model};
            window.dynaflux = new DynaReactive(root, dashboard.attach(model));
        })();
    </script>
</body>
</html>`;

export { getSimulationDocument };
