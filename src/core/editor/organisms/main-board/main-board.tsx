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
const MainBoard = () => {
  const [code, setCode] = useState(mockedCode);
  const [play, setPlay] = useState(false);
  const [isVisibleForrester, setVisibleForrester] = useState(false);
  const [htmlCode, setHtmlCode] = useState(mockedHtml);
  const draggableRef = useRef<HTMLHRElement>(null);
  const [leftPorcent, setPorcent] = useState(50);
  const mouseDown = useRef(false);
  const [isMouseMove, setMouseMove] = useState(false);
  useEffect(() => {
    draggableRef.current?.addEventListener('mousedown', (e) => {
      mouseDown.current = true;
    });
    draggableRef.current?.addEventListener('mouseup', (e) => {
      mouseDown.current = false;
      setMouseMove(false);
    });
    document.addEventListener('mousemove', (e) => {
      if (mouseDown.current) {
        setMouseMove(true);
        e.preventDefault();
        window.innerWidth;
        let porcent = Math.ceil((e.clientX * 100) / window.innerWidth);
        setPorcent(porcent);
      }
    });
    document.addEventListener('mouseup', (e) => {
      mouseDown.current = false;
      setMouseMove(false);
    });

    return () => {
      document.removeEventListener('mousemove', () => {});
      document.removeEventListener('mouseup', () => {});
      draggableRef.current?.removeEventListener('mousedown', () => {});
      draggableRef.current?.removeEventListener('mouseup', () => {});
    };
  }, []);
  const handlerPlay = (isPlay: boolean) => {
    console.log('is play ', isPlay);
    setPlay(isPlay);
  };
  const handlerForrester  = (isVisible: boolean) => {
    setVisibleForrester(isVisible);
  } 
  return (
    <div>
      <Header play={handlerPlay} visibleForrester={handlerForrester} />
      <div className={styles.container}>
        <Panel width={`${leftPorcent}%`}>
          <Editor
            height='50vh'
            defaultLanguage='javascript'
            defaultValue='const model = { }'
            theme='vs-dark'
            value={code}
            onChange={(value) => setCode(value || '')}
          />
          <Editor
            height='50vh'
            defaultLanguage='html'
            defaultValue='<div></div>'
            value={htmlCode}
            onChange={(value) => setHtmlCode(value || '')}
          />
        </Panel>
        <hr ref={draggableRef} className={styles.draggable} />
        <Panel width={`${100 - leftPorcent}%`}>
          <IframeViewer src='/forrester' title='Iframe Example' isVisibleForrester={isVisibleForrester}/>
          {isMouseMove && <div className={styles.overlay}></div>}
          <WrapperFlow model={code} html={htmlCode} isPlay={play} />
        </Panel>
      </div>
    </div>
  );
};
export default MainBoard;
