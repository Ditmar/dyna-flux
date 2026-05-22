import { useEffect, useRef } from 'react';
import { getWrapperHead, getWrapperBody } from '../wrapper-flow/utils/html';
import React from 'react';
import { getBaseCodeBlock } from './utils/parsecode';
import { renderInitPlotyData } from './utils/parsecode';
import { injectBeforeLoop } from './utils/injectIntoUpdate';
import { injectAfterLoop } from './utils/injectIntoUpdate';
import { injectInsideLoopStart } from './utils/injectIntoUpdate';
interface WrapperFlowProps {
  model: string;
  html: string;
  isPlay: boolean;
}

const WrapperFlow: React.FC<WrapperFlowProps> = (props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { model, html, isPlay } = props;
  let baseCode = getBaseCodeBlock(model);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const plotlyJS = renderInitPlotyData(html);
      baseCode = injectBeforeLoop(baseCode, plotlyJS[0]);
      baseCode = injectInsideLoopStart(baseCode, plotlyJS[1]);
      baseCode = injectAfterLoop(baseCode, plotlyJS[2]);

      console.log('baseCode', baseCode);
      const iframeDocument = iframe.contentWindow?.document;
      if (iframeDocument) {
        iframeDocument.open();
        iframeDocument.write(`
          ${getWrapperHead('Dinamica de Sistemas', baseCode, '')}
          ${getWrapperBody(html)}
          `);
        const iframeBody = iframeDocument.body;
        if (iframeBody) {
          iframeBody.style.overflow = 'hidden';
          iframeBody.style.height = '100%';
          iframeBody.style.margin = '0';
          iframeBody.style.padding = '0';
        }
        iframeDocument.close();
      }
    }
  }, [isPlay]);
  return (
    <iframe
      ref={iframeRef}
      style={{
        width: '100%',
        height: `100vh`,
        overflow: 'visible',
        border: 'none',
        clip: 'auto',
      }}
    />
  );
};

export default WrapperFlow;
