import React, { useEffect, useRef } from 'react';

type IframeViewerProps = {
  src: string;
  title?: string;
  isVisibleForrester: boolean;
  reloadSignal?: number;
};

const IframeViewer: React.FC<IframeViewerProps> = ({ src, title = 'Contenido externo', isVisibleForrester, reloadSignal }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (reloadSignal === undefined || reloadSignal === 0) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'reloadDiagram' }, '*');
  }, [reloadSignal]);

  if (!src) return <p>No se proporcionó una URL</p>;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 50px)', border: '1px solid #ccc', display: isVisibleForrester ? 'block' : 'none' }}>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allowFullScreen
      />
    </div>
  );
};

export default IframeViewer;