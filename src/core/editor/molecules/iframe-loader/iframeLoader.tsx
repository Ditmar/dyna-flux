import React from 'react';

type IframeViewerProps = {
  src: string;
  title?: string;
  isVisibleForrester: boolean;
};

const IframeViewer: React.FC<IframeViewerProps> = ({ src, title = 'Contenido externo', isVisibleForrester }) => {
  if (!src) return <p>No se proporcionó una URL</p>;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 50px)', border: '1px solid #ccc', display: isVisibleForrester ? 'block' : 'none' }}>
      <iframe
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