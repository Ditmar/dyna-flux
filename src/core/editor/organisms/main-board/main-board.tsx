import React, { useCallback, useEffect, useRef, useState } from 'react';
import Panel from '../../molecules/panel/panel';
import styles from './main-board.module.scss';
import Editor from '@monaco-editor/react';
import WrapperFlow from '../../molecules/wrapper-flow/wrapper-flow';
import Header from '../../atoms/top-bar/top-bar';
import IframeViewer from '../../molecules/iframe-loader/iframeLoader';
import AuthModal from '../../atoms/auth-modal/auth-modal';
import type { Project, AuthUser } from '../../atoms/top-bar/top-bar.types';

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

const LS_CODE         = 'dyna-flux:code';
const LS_HTML         = 'dyna-flux:html';
const LS_PROJECT_ID   = 'dyna-flux:projectId';
const LS_PROJECT_NAME = 'dyna-flux:projectName';

type FullscreenSide = 'left' | 'right' | null;

const ExpandIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="5,1 1,1 1,5" /><polyline points="11,1 15,1 15,5" />
    <polyline points="15,11 15,15 11,15" /><polyline points="1,11 1,15 5,15" />
  </svg>
);
const CollapseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="1,5 5,5 5,1" /><polyline points="15,5 11,5 11,1" />
    <polyline points="11,15 11,11 15,11" /><polyline points="5,15 5,11 1,11" />
  </svg>
);

const MainBoard = () => {
  const [code, setCode]         = useState(() => localStorage.getItem(LS_CODE) ?? mockedCode);
  const [htmlCode, setHtmlCode] = useState(() => localStorage.getItem(LS_HTML) ?? mockedHtml);
  const [play, setPlay]         = useState(false);
  const [isVisibleForrester, setVisibleForrester] = useState(false);
  const [leftPorcent, setPorcent] = useState(50);
  const [fullscreen, setFullscreen] = useState<FullscreenSide>(null);
  const [isMouseMove, setMouseMove] = useState(false);
  const mouseDown = useRef(false);

  // Auth state
  const [authUser, setAuthUser]     = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth]     = useState(false);

  // Project state
  const [projects, setProjects]             = useState<Project[]>([]);
  const [projectName, setProjectName]       = useState(() => localStorage.getItem(LS_PROJECT_NAME) ?? 'Untitled');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => localStorage.getItem(LS_PROJECT_ID));
  const [isSaving, setIsSaving]             = useState(false);

  // ── Check auth on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(user => { setAuthUser(user); setAuthChecked(true); })
      .catch(() => setAuthChecked(true));
  }, []);

  // ── Fetch projects when logged in ───────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) setProjects(await res.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => { if (authUser) fetchProjects(); }, [authUser, fetchProjects]);

  // ── Forrester postMessage ───────────────────────────────────────────────
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

  // ── Panel drag ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown.current) return;
      setMouseMove(true);
      e.preventDefault();
      setPorcent(Math.ceil((e.clientX * 100) / window.innerWidth));
    };
    const onMouseUp = () => { mouseDown.current = false; setMouseMove(false); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Auth handlers ───────────────────────────────────────────────────────
  const handleAuthSuccess = (user: AuthUser) => {
    setAuthUser(user);
    setShowAuth(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthUser(null);
    setProjects([]);
    setCurrentProjectId(null);
    setProjectName('Untitled');
    localStorage.removeItem(LS_PROJECT_ID);
    localStorage.removeItem(LS_PROJECT_NAME);
  };

  // ── Project save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body = {
        name:     projectName,
        diagram:  localStorage.getItem('dyna-flux:diagram'),
        code:     localStorage.getItem(LS_CODE),
        html:     localStorage.getItem(LS_HTML),
        settings: localStorage.getItem('dyna-flux:settings'),
      };

      let res: Response;
      if (currentProjectId) {
        res = await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        const project: Project = await res.json();
        setCurrentProjectId(project.id);
        localStorage.setItem(LS_PROJECT_ID, project.id);
        localStorage.setItem(LS_PROJECT_NAME, projectName);
        await fetchProjects();
      }
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Project load ────────────────────────────────────────────────────────
  const handleLoadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const project = await res.json();

      setCurrentProjectId(project.id);
      setProjectName(project.name);
      localStorage.setItem(LS_PROJECT_ID, project.id);
      localStorage.setItem(LS_PROJECT_NAME, project.name);

      if (project.diagram) localStorage.setItem('dyna-flux:diagram', project.diagram);
      if (project.settings) localStorage.setItem('dyna-flux:settings', project.settings);

      if (project.code) { setCode(project.code); localStorage.setItem(LS_CODE, project.code); }
      if (project.html) { setHtmlCode(project.html); localStorage.setItem(LS_HTML, project.html); }
    } catch (err) {
      console.error('Load failed', err);
    }
  };

  // ── Project delete ──────────────────────────────────────────────────────
  const handleDeleteProject = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (currentProjectId === id) {
        setCurrentProjectId(null);
        localStorage.removeItem(LS_PROJECT_ID);
      }
      await fetchProjects();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  // ── New project ─────────────────────────────────────────────────────────
  const handleNewProject = () => {
    setCurrentProjectId(null);
    setProjectName('Untitled');
    localStorage.removeItem(LS_PROJECT_ID);
    localStorage.removeItem(LS_PROJECT_NAME);
  };

  // ── Other handlers ──────────────────────────────────────────────────────
  const handlerPlay      = (isPlay: boolean) => setPlay(isPlay);
  const handlerForrester = (isVisible: boolean) => setVisibleForrester(isVisible);
  const handlerBaseModel = () => {
    setCode(mockedCode);
    setHtmlCode(mockedHtml);
    localStorage.setItem(LS_CODE, mockedCode);
    localStorage.setItem(LS_HTML, mockedHtml);
  };
  const toggleFullscreen = (side: 'left' | 'right') =>
    setFullscreen(prev => prev === side ? null : side);

  const leftWidth  = fullscreen === 'left'  ? '100%' : `${leftPorcent}%`;
  const rightWidth = fullscreen === 'right' ? '100%' : `${100 - leftPorcent}%`;

  if (!authChecked) return null;

  return (
    <div>
      <Header
        play={handlerPlay}
        visibleForrester={handlerForrester}
        baseModel={handlerBaseModel}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onSave={handleSave}
        onNewProject={handleNewProject}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        projects={projects}
        isSaving={isSaving}
        currentProjectId={currentProjectId}
        authUser={authUser}
        onOpenAuth={() => setShowAuth(true)}
        onLogout={handleLogout}
      />

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

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default MainBoard;
