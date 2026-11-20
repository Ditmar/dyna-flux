import React, { useEffect, useRef } from 'react';
import { getSimulationDocument } from './utils/html';
import { getBaseCodeBlock } from './utils/parsecode';
import { injectInsideLoopStart } from './utils/injectIntoUpdate';
import type { DashboardSpec } from '../../dashboard/dashboard';

interface WrapperFlowProps {
  /** Code of the last *executed* run (not the live editor contents). */
  model: string;
  dashboard: DashboardSpec;
  /** Incremented on every Run, so re-running the same code restarts the simulation. */
  runId: number;
}

const WrapperFlow: React.FC<WrapperFlowProps> = ({ model, dashboard, runId }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ model, dashboard });
  latest.current = { model, dashboard };
  const dashboardKey = JSON.stringify(dashboard);
  const renderedRun = useRef<number | null>(null);

  // Render immediately on mount and on every Run; panel design changes are
  // debounced so typing a title does not rebuild the iframe on each keystroke.
  useEffect(() => {
    const immediate = renderedRun.current !== runId;
    renderedRun.current = runId;
    const timer = setTimeout(() => {
      const doc = iframeRef.current?.contentWindow?.document;
      if (!doc) return;
      const { model: code, dashboard: spec } = latest.current;
      // Record every simulation step for the charts and tables.
      const modelCode = injectInsideLoopStart(getBaseCodeBlock(code), 'if (window.__DF) __DF.record(this);');
      doc.open();
      doc.write(getSimulationDocument('Dinámica de Sistemas', modelCode, spec));
      doc.close();
    }, immediate ? 0 : 250);
    return () => clearTimeout(timer);
  }, [runId, model, dashboardKey]);

  return (
    <iframe
      ref={iframeRef}
      title="Simulación"
      style={{ width: '100%', height: 'calc(100vh - 50px)', border: 'none', display: 'block' }}
    />
  );
};

export default WrapperFlow;
