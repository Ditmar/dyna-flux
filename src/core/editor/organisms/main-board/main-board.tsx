import React, { useCallback, useEffect, useRef, useState } from 'react';
import Panel from '../../molecules/panel/panel';
import styles from './main-board.module.scss';
import Editor from '@monaco-editor/react';
import WrapperFlow from '../../molecules/wrapper-flow/wrapper-flow';
import Header from '../../atoms/top-bar/top-bar';
import IframeViewer from '../../molecules/iframe-loader/iframeLoader';
import AuthModal from '../../atoms/auth-modal/auth-modal';
import DashboardBuilder from '../dashboard-builder/dashboard-builder';
import { normalizeDashboard, dashboardFromLegacyHtml, emptyDashboard } from '../../dashboard/dashboard';
import type { DashboardSpec } from '../../dashboard/dashboard';
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
const mockedDashboard = (): DashboardSpec => ({
  version: 1,
  controls: [
    { id: 'c-final', var: 'finalTime', label: 'Tiempo final', min: 2, max: 300, step: 1, kind: 'number' },
    { id: 'c-x0', var: 'x0', label: 'Población inicial', min: 0, max: 100, step: 1, kind: 'slider' },
  ],
  widgets: [
    { id: 'w-x', type: 'chart', title: 'Población', size: 'normal', x: 'time', series: ['x'], chartType: 'line' },
  ],
});

const LS_CODE         = 'dyna-flux:code';
const LS_HTML         = 'dyna-flux:html';        // legacy: hand-written HTML panel
const LS_DASHBOARD    = 'dyna-flux:dashboard';
const LS_PROJECT_ID   = 'dyna-flux:projectId';
const LS_PROJECT_NAME = 'dyna-flux:projectName';
const LS_DIAGRAM      = 'dyna-flux:diagram';
const LS_SETTINGS     = 'dyna-flux:settings';

interface ProjectPayload {
  id: string;
  name: string;
  diagram?: string | null;
  code?: string | null;
  html?: string | null;
  dashboard?: string | null;
  settings?: string | null;
  isPublic?: boolean;
}

// Write a value to localStorage, or remove the key when the value is missing,
// so data from a previously opened project never leaks into the next one.
const setOrRemove = (key: string, value: string | null | undefined) => {
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
};

// Results panel of a project: the saved dashboard, or a conversion of the
// HTML panel used by projects created before the visual designer existed.
const dashboardFromProject = (project: ProjectPayload): DashboardSpec => {
  if (project.dashboard) return normalizeDashboard(project.dashboard);
  if (project.html) return dashboardFromLegacyHtml(project.html);
  return project.code ? emptyDashboard() : mockedDashboard();
};

const loadInitialDashboard = (): DashboardSpec => {
  const saved = localStorage.getItem(LS_DASHBOARD);
  if (saved) return normalizeDashboard(saved);
  const legacy = localStorage.getItem(LS_HTML);
  return legacy ? dashboardFromLegacyHtml(legacy) : mockedDashboard();
};

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
  // The simulation shows the last *executed* code: editing the code marks the
  // results as outdated until the user runs it (Run button / Ctrl+Enter).
  const [run, setRun]           = useState(() => ({ code: localStorage.getItem(LS_CODE) ?? mockedCode, id: 0 }));
  const codeRef = useRef(code);
  codeRef.current = code;
  const [dashboard, setDashboard] = useState<DashboardSpec>(loadInitialDashboard);
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
  const [currentProjectIsPublic, setCurrentProjectIsPublic] = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [forresterReloadSignal, setForresterReloadSignal] = useState(0);

  // Persist the panel design locally (and drop the migrated legacy HTML).
  useEffect(() => {
    localStorage.setItem(LS_DASHBOARD, JSON.stringify(dashboard));
    localStorage.removeItem(LS_HTML);
  }, [dashboard]);

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

  // ── Run ─────────────────────────────────────────────────────────────────
  const runSimulation = useCallback((source?: string) => {
    const nextCode = source ?? codeRef.current;
    setRun(r => ({ code: nextCode, id: r.id + 1 }));
  }, []);

  // Replace the editor contents and run them (project load, templates, Forrester).
  const loadCode = useCallback((nextCode: string) => {
    codeRef.current = nextCode;
    setCode(nextCode);
    localStorage.setItem(LS_CODE, nextCode);
    runSimulation(nextCode);
  }, [runSimulation]);

  // Ctrl/Cmd+Enter runs from anywhere (Monaco registers its own command).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
      if ((e.target as HTMLElement | null)?.closest?.('.monaco-editor')) return;
      e.preventDefault();
      runSimulation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runSimulation]);

  // ── Apply a project to the editor state ─────────────────────────────────
  // Every field is written (or cleared), so nothing from the previous project
  // survives, and the Forrester iframe reloads both diagram AND settings.
  const applyProject = useCallback((project: ProjectPayload, isPublic: boolean) => {
    const nextCode = project.code ?? mockedCode;

    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setCurrentProjectIsPublic(isPublic);
    loadCode(nextCode);
    setDashboard(dashboardFromProject(project));

    localStorage.setItem(LS_PROJECT_ID, project.id);
    localStorage.setItem(LS_PROJECT_NAME, project.name);
    setOrRemove(LS_DIAGRAM, project.diagram);
    setOrRemove(LS_SETTINGS, project.settings);

    setForresterReloadSignal(s => s + 1);
  }, [loadCode]);

  // ── Deep-link: load shared project from URL ?p=<id> ────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('p');
    if (!shareId) return;

    fetch(`/api/projects/public/${shareId}`)
      .then(r => r.ok ? r.json() : null)
      .then((project: ProjectPayload | null) => {
        if (!project) return;
        applyProject(project, true);
        window.history.replaceState(null, '', `/?p=${project.id}`);
      })
      .catch(() => { /* ignore */ });
  }, [applyProject]);

  // ── Forrester postMessage ───────────────────────────────────────────────
  useEffect(() => {
    const onForresterMessage = (event: MessageEvent) => {
      if (event.data?.type === 'forresterModel') {
        loadCode(event.data.code || '');
        setDashboard(event.data.dashboard
          ? normalizeDashboard(event.data.dashboard)
          : dashboardFromLegacyHtml(event.data.html));
      }
    };
    window.addEventListener('message', onForresterMessage);
    return () => window.removeEventListener('message', onForresterMessage);
  }, [loadCode]);

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
      const body = JSON.stringify({
        name:     projectName,
        diagram:  localStorage.getItem(LS_DIAGRAM),
        code,
        dashboard: JSON.stringify(dashboard),
        settings: localStorage.getItem(LS_SETTINGS),
      });
      const headers = { 'Content-Type': 'application/json' };

      let res: Response | null = null;
      if (currentProjectId) {
        res = await fetch(`/api/projects/${currentProjectId}`, { method: 'PUT', headers, body });
      }
      // No project yet, or the project belongs to someone else (opened from a
      // share link) → save it as a new project in the current user's account.
      if (!res || res.status === 404) {
        res = await fetch('/api/projects', { method: 'POST', headers, body });
      }

      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Sesión expirada, vuelve a iniciar sesión' : `HTTP ${res.status}`);
      }

      const project: Project = await res.json();
      if (project.id !== currentProjectId) {
        setCurrentProjectIsPublic(Boolean(project.isPublic));
        if (new URLSearchParams(window.location.search).has('p')) {
          window.history.replaceState(null, '', '/');
        }
      }
      setCurrentProjectId(project.id);
      localStorage.setItem(LS_PROJECT_ID, project.id);
      localStorage.setItem(LS_PROJECT_NAME, projectName);
      await fetchProjects();
    } catch (err) {
      console.error('Save failed', err);
      alert(`No se pudo guardar el proyecto: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Project load ────────────────────────────────────────────────────────
  const handleLoadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const project: ProjectPayload = await res.json();
      applyProject(project, Boolean(project.isPublic));
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
    setCurrentProjectIsPublic(false);
    loadCode(mockedCode);
    setDashboard(mockedDashboard());
    localStorage.removeItem(LS_PROJECT_ID);
    localStorage.removeItem(LS_PROJECT_NAME);
    localStorage.removeItem(LS_DIAGRAM);
    localStorage.removeItem(LS_SETTINGS);
    if (new URLSearchParams(window.location.search).has('p')) {
      window.history.replaceState(null, '', '/');
    }
    setForresterReloadSignal(s => s + 1);
  };

  // ── Share project ───────────────────────────────────────────────────────
  const handleShareProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true }),
      });
      if (res.ok) {
        setCurrentProjectIsPublic(true);
        setProjects(prev => prev.map(p => p.id === id ? { ...p, isPublic: true } : p));
      }
    } catch (err) {
      console.error('Share failed', err);
    }
  };

  // ── Other handlers ──────────────────────────────────────────────────────
  const handlerForrester = (isVisible: boolean) => setVisibleForrester(isVisible);
  const handlerBaseModel = () => {
    loadCode(mockedCode);
    setDashboard(mockedDashboard());
  };
  const toggleFullscreen = (side: 'left' | 'right') =>
    setFullscreen(prev => prev === side ? null : side);

  const leftWidth  = fullscreen === 'left'  ? '100%' : `${leftPorcent}%`;
  const rightWidth = fullscreen === 'right' ? '100%' : `${100 - leftPorcent}%`;

  if (!authChecked) return null;

  return (
    <div>
      <Header
        onRun={() => runSimulation()}
        hasPendingChanges={code !== run.code}
        visibleForrester={handlerForrester}
        baseModel={handlerBaseModel}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onSave={handleSave}
        onNewProject={handleNewProject}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        onShareProject={handleShareProject}
        projects={projects}
        isSaving={isSaving}
        currentProjectId={currentProjectId}
        currentProjectIsPublic={currentProjectIsPublic}
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
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runSimulation(editor.getValue()));
              }}
              onChange={(value) => {
                const v = value || '';
                setCode(v);
                localStorage.setItem(LS_CODE, v);
              }}
            />
            <DashboardBuilder value={dashboard} onChange={setDashboard} modelCode={code} />
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
            <IframeViewer src='/forrester' title='Iframe Example' isVisibleForrester={isVisibleForrester} reloadSignal={forresterReloadSignal} />
            {isMouseMove && <div className={styles.overlay}></div>}
            <WrapperFlow model={run.code} dashboard={dashboard} runId={run.id} />
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
