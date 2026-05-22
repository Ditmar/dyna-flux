import React, { useEffect, useRef, useState } from 'react';
import Panel from '../../molecules/panel/panel';
import styles from './main-board.module.scss';
import Editor from '@monaco-editor/react';
import WrapperFlow from '../../molecules/wrapper-flow/wrapper-flow';
import Header from '../../atoms/top-bar/top-bar';
import IframeViewer from '../../molecules/iframe-loader/iframeLoader';
const mockedCode = `
const model = {
  initialize: function () {
    this.x0 = 0;
    this.a = 0.1;
    this.xd = 500;
    this.b = 0.05;
    this.step = 0;
    this.dt = [1, 0.5, 0.25, 0.125, 0.0625];
    this.initTime = 0;
    this.finalTime = 100;
  },
  update: function () {
    this.x = this.x0;
    for (this.time = this.initTime; this.time < this.finalTime; this.time += this.dt[this.step]) {
      // Ecuacion diferencial
    }
  }
};


`;
const mockedHtml = `

<p id="example">
  Final Time <span data-var="finalTime" class="TKAdjustableNumber" data-min="2" data-max="300"></span>
poblacion inicial <span data-var="x" class="TKAdjustableNumber" data-min="0" data-ma="100", data-step="1"></span>

</p>
<div id='negative' class='plotly'  data-plotly='[time, x]'></div>

`;
const LS_CODE = 'dyna-flux:code';
const LS_HTML = 'dyna-flux:html';

type FullscreenSide = 'left' | 'right' | null;

const ExpandIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="5,1 1,1 1,5" />
    <polyline points="11,1 15,1 15,5" />
    <polyline points="15,11 15,15 11,15" />
    <polyline points="1,11 1,15 5,15" />
  </svg>
);

const CollapseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="1,5 5,5 5,1" />
    <polyline points="15,5 11,5 11,1" />
    <polyline points="11,15 11,11 15,11" />
    <polyline points="5,15 5,11 1,11" />
  </svg>
);

const MainBoard = () => {
  const [code, setCode] = useState(() => localStorage.getItem(LS_CODE) ?? mockedCode);
  const [play, setPlay] = useState(false);
  const [isVisibleForrester, setVisibleForrester] = useState(false);
  const [htmlCode, setHtmlCode] = useState(() => localStorage.getItem(LS_HTML) ?? mockedHtml);
  const [leftPorcent, setPorcent] = useState(50);
  const mouseDown = useRef(false);
  const [isMouseMove, setMouseMove] = useState(false);
  const [fullscreen, setFullscreen] = useState<FullscreenSide>(null);

  useEffect(() => {
    const onForresterMessage = (event: MessageEvent) => {
      if (event.data?.type === 'forresterModel') {
        const newCode = event.data.code || '';
        const newHtml = event.data.html || '';
        setCode(newCode);
        setHtmlCode(newHtml);
        localStorage.setItem(LS_CODE, newCode);
        localStorage.setItem(LS_HTML, newHtml);
      }
    };
    window.addEventListener('message', onForresterMessage);
    return () => window.removeEventListener('message', onForresterMessage);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown.current) return;
      setMouseMove(true);
      e.preventDefault();
      const porcent = Math.ceil((e.clientX * 100) / window.innerWidth);
      setPorcent(porcent);
    };
    const onMouseUp = () => {
      mouseDown.current = false;
      setMouseMove(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handlerPlay = (isPlay: boolean) => {
    setPlay(isPlay);
  };
  const handlerForrester = (isVisible: boolean) => {
    setVisibleForrester(isVisible);
  };
  const handlerBaseModel = () => {
    setCode(mockedCode);
    setHtmlCode(mockedHtml);
    localStorage.setItem(LS_CODE, mockedCode);
    localStorage.setItem(LS_HTML, mockedHtml);
  };

  const toggleFullscreen = (side: 'left' | 'right') => {
    setFullscreen((prev) => (prev === side ? null : side));
  };

  const leftWidth = fullscreen === 'left' ? '100%' : `${leftPorcent}%`;
  const rightWidth = fullscreen === 'right' ? '100%' : `${100 - leftPorcent}%`;

  return (
    <div>
      <Header play={handlerPlay} visibleForrester={handlerForrester} baseModel={handlerBaseModel} />
      <div className={styles.container}>
        <div
          className={styles.panelWrapper}
          style={{ width: leftWidth, display: fullscreen === 'right' ? 'none' : undefined }}
        >
          <Panel width="100%">
            <Editor
              height='50vh'
              defaultLanguage='javascript'
              defaultValue='const model = { }'
              theme='vs-dark'
              value={code}
              options={{ automaticLayout: true }}
              onChange={(value) => {
                const v = value || '';
                setCode(v);
                localStorage.setItem(LS_CODE, v);
              }}
            />
            <Editor
              height='50vh'
              defaultLanguage='html'
              defaultValue='<div></div>'
              value={htmlCode}
              options={{ automaticLayout: true }}
              onChange={(value) => {
                const v = value || '';
                setHtmlCode(v);
                localStorage.setItem(LS_HTML, v);
              }}
            />
          </Panel>
          <button
            className={styles.fullscreenBtn}
            onClick={() => toggleFullscreen('left')}
            title={fullscreen === 'left' ? 'Restore split' : 'Fullscreen'}
          >
            {fullscreen === 'left' ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </div>

        <hr
          className={styles.draggable}
          style={{ display: fullscreen ? 'none' : undefined }}
          onMouseDown={() => { mouseDown.current = true; }}
        />

        <div
          className={styles.panelWrapper}
          style={{ width: rightWidth, display: fullscreen === 'left' ? 'none' : undefined }}
        >
          <Panel width="100%">
            <IframeViewer src='/forrester' title='Iframe Example' isVisibleForrester={isVisibleForrester} />
            {isMouseMove && <div className={styles.overlay}></div>}
            <WrapperFlow model={code} html={htmlCode} isPlay={play} />
          </Panel>
          <button
            className={styles.fullscreenBtn}
            onClick={() => toggleFullscreen('right')}
            title={fullscreen === 'right' ? 'Restore split' : 'Fullscreen'}
          >
            {fullscreen === 'right' ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </div>
      </div>
    </div>
  );
};
export default MainBoard;
