import React, { useEffect, useRef, useState } from 'react';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import type { AuthUser } from '../top-bar/top-bar.types';
import styles from './auth-modal.module.scss';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialTab?: 'login' | 'register';
}

const AuthModal = ({ onClose, onSuccess, initialTab = 'login' }: AuthModalProps) => {
  const [tab, setTab]                       = useState<'login' | 'register'>(initialTab);
  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setError('');
  };

  const switchTab = (t: 'login' | 'register') => { reset(); setTab(t); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'register' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body     = tab === 'login'
        ? { email, password }
        : { email, password, name: name || undefined };

      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }

      onSuccess(data.user);
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className={styles.logo}>dyna-flux</div>
        <p className={styles.tagline}>System dynamics, simplified</p>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => switchTab('login')} type="button">
            Sign In
          </button>
          <button className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`} onClick={() => switchTab('register')} type="button">
            Register
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Name (optional)</label>
              <div className={styles.inputWrap}>
                <User size={13} className={styles.inputIcon} />
                <input className={styles.input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" disabled={loading} autoComplete="name" />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <Mail size={13} className={styles.inputIcon} />
              <input ref={emailRef} className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required disabled={loading} autoComplete="email" />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrap}>
              <Lock size={13} className={styles.inputIcon} />
              <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={tab === 'register' ? 'Min. 6 characters' : '••••••••'} required disabled={loading} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} />
            </div>
          </div>

          {tab === 'register' && (
            <div className={styles.field}>
              <label className={styles.label}>Confirm Password</label>
              <div className={styles.inputWrap}>
                <Lock size={13} className={styles.inputIcon} />
                <input className={styles.input} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required disabled={loading} autoComplete="new-password" />
              </div>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading
              ? <><Loader2 size={14} className={styles.spin} /> Loading…</>
              : tab === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        <p className={styles.switchHint}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className={styles.switchLink} onClick={() => switchTab(tab === 'login' ? 'register' : 'login')} type="button">
            {tab === 'login' ? 'Register here' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
