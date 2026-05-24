import React, { useEffect, useRef, useState } from 'react';
import type { HeaderProps, Project } from './top-bar.types';
import styles from './top-bar.module.scss';
import {
  Play, Square, GitBranch, FileCode, Save, FolderOpen,
  Trash2, Plus, Loader2, LogIn, LogOut, UserPlus, Share2, Check,
} from 'lucide-react';

const Header = (props: HeaderProps) => {
  const {
    play, visibleForrester, baseModel,
    projectName, onProjectNameChange,
    onSave, onNewProject, onLoadProject, onDeleteProject, onShareProject,
    projects, isSaving, currentProjectId, currentProjectIsPublic,
    authUser, onOpenAuth, onLogout,
  } = props;

  const [isPlaying, setPlaying]               = useState(false);
  const [isForresterVisible, setForresterVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen]        = useState(false);
  const [copied, setCopied]                    = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handlerPlay = () => { const n = !isPlaying; setPlaying(n); play(n); };
  const showForrester = () => { const n = !isForresterVisible; setForresterVisible(n); visibleForrester(n); };

  const handleShare = async () => {
    if (!currentProjectId) return;
    await onShareProject(currentProjectId);
    const url = `${window.location.origin}/?p=${currentProjectId}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.header}>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.brandName}>dyna-flux</span>
      </div>

      {/* Project section — only when logged in */}
      {authUser && (
        <div className={styles.projectSection}>
          <input
            className={styles.projectNameInput}
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="Project name…"
            maxLength={80}
          />

          <button
            className={`${styles.btn} ${styles.btnSave}`}
            onClick={onSave}
            disabled={isSaving}
            title={currentProjectId ? 'Save project' : 'Save new project'}
          >
            {isSaving
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Save size={14} />}
            {isSaving ? 'Saving…' : 'Save'}
          </button>

          {currentProjectId && (
            <button
              className={`${styles.btn} ${currentProjectIsPublic ? styles.btnShare : styles.btnSecondary}`}
              onClick={handleShare}
              title={currentProjectIsPublic ? 'Link copied! Project is public' : 'Share — make public & copy link'}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}

          <div className={styles.projectDropdownWrap} ref={dropdownRef}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setDropdownOpen(o => !o)}
              title="Open saved project"
            >
              <FolderOpen size={14} /> Open
            </button>

            {dropdownOpen && (
              <div className={styles.projectList}>
                <div className={styles.projectListHeader}>Saved Projects</div>

                {projects.length === 0 ? (
                  <div className={styles.projectEmpty}>No saved projects yet</div>
                ) : projects.map((p: Project) => (
                  <div
                    key={p.id}
                    className={`${styles.projectItem} ${p.id === currentProjectId ? styles.active : ''}`}
                    onClick={() => { onLoadProject(p.id); setDropdownOpen(false); }}
                  >
                    <div className={styles.projectItemInfo}>
                      <div className={styles.projectItemName}>{p.name}</div>
                      <div className={styles.projectItemDate}>{formatDate(p.updatedAt)}</div>
                    </div>
                    <button
                      className={styles.projectItemDelete}
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                      title="Delete project"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                <button className={styles.projectNewBtn} onClick={() => { onNewProject(); setDropdownOpen(false); }}>
                  <Plus size={13} /> New project
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simulation actions */}
      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${isPlaying ? styles.btnActive : styles.btnPlay}`}
          onClick={handlerPlay}
          title={isPlaying ? 'Stop simulation' : 'Run simulation'}
        >
          {isPlaying ? <Square size={15} /> : <Play size={15} />}
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={baseModel} title="Load base model template">
          <FileCode size={15} /> Base Model
        </button>

        <button
          className={`${styles.btn} ${isForresterVisible ? styles.btnActive : styles.btnSecondary}`}
          onClick={showForrester}
          title="Toggle Forrester diagram"
        >
          <GitBranch size={15} /> Forrester
        </button>
      </div>

      {/* Auth section */}
      <div className={styles.authSection}>
        {authUser ? (
          <>
            <span className={styles.userEmail} title={authUser.email}>
              {authUser.name ?? authUser.email}
            </span>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onLogout} title="Sign out">
              <LogOut size={14} /> Sign Out
            </button>
          </>
        ) : (
          <>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onOpenAuth} title="Sign in">
              <LogIn size={14} /> Sign In
            </button>
            <button className={`${styles.btn} ${styles.btnRegister}`} onClick={onOpenAuth} title="Create account">
              <UserPlus size={14} /> Register
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Header;
