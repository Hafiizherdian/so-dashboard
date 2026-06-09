'use client';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, BarChart3, AlertCircle, LogIn, User } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_SANS = 'IBM Plex Sans, sans-serif';
const FONT_MONO = 'IBM Plex Mono, monospace';

// ─── Style Builders ───────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: FONT_SANS,
  } as React.CSSProperties,

  card: (mounted: boolean): React.CSSProperties => ({
    width: '100%',
    maxWidth: 390,
    background: '#ffffff',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: 20,
    padding: '36px 32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    position: 'relative',
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(18px)',
    transition: 'opacity 0.4s ease, transform 0.4s ease',
  }),

  accentLine: {
    position: 'absolute',
    top: 0,
    left: 32,
    right: 32,
    height: 3,
    background: '#6366f1',
    borderRadius: '0 0 4px 4px',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    borderRadius: 10,
    background: '#f7f8fa',
    border: '1px solid rgba(0,0,0,0.1)',
    color: '#111827',
    outline: 'none',
    fontFamily: FONT_SANS,
    transition: 'border-color 0.15s',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 7,
    fontFamily: FONT_MONO,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  } as React.CSSProperties,

  submitButton: (loading: boolean): React.CSSProperties => ({
    marginTop: 8,
    padding: '11px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: FONT_SANS,
    letterSpacing: '0.01em',
    background: loading ? 'rgba(99,102,241,0.55)' : '#6366f1',
    color: loading ? 'rgba(255,255,255,0.6)' : '#fff',
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    transition: 'background 0.2s',
    width: '100%',
  }),
};

// ─── Input focus/blur handlers ────────────────────────────────────────────────

const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(99,102,241,0.5)';
    e.target.style.background = '#fff';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(0,0,0,0.1)';
    e.target.style.background = '#f7f8fa';
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg
      style={{ animation: 'spin 1s linear infinite', width: 15, height: 15 }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" />
    </svg>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(239,68,68,0.06)',
      border: '1px solid rgba(239,68,68,0.18)',
      color: '#dc2626', fontSize: 13, marginBottom: 20,
      fontFamily: FONT_MONO,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {message}
    </div>
  );
}

function CardLogo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52,
        background: '#6366f1',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
        boxShadow: '0 6px 20px rgba(99,102,241,0.25)',
      }}>
        <img src="/logo-s3.jpeg" alt="SSS" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'contain' }}/>
      </div>
      <div style={{
        fontSize: 17,
        fontWeight: 700,
        color: '#111827',
        fontFamily: FONT_MONO,
        letterSpacing: '-0.02em',
        marginBottom: 4,
      }}>
        SSS Dashboard
      </div>
      <div style={{
        fontSize: 10,
        color: '#9ca3af',
        fontFamily: FONT_MONO,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        Sales · Penjualan · Outstanding
      </div>
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm() {
  const { login, user, loading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = '/';
    }
  }, [user, loading]);

  const clearError = () => setError('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi');
      return;
    }

    setIsLoading(true);
    clearError();

    const r = await login(username.trim(), password);

    if (r.success) {
      setTimeout(() => { window.location.href = '/'; }, 400);
    } else {
      setError(r.error || 'Login gagal');
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.card(mounted)}>

      {/* Indigo accent top line */}
      <div style={styles.accentLine} />

      {/* Logo + title */}
      <CardLogo />

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Username */}
        <div>
          <label style={styles.label}>Username</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); clearError(); }}
              placeholder="Masukkan username"
              autoComplete="username"
              autoFocus
              style={{ ...styles.input, paddingRight: 38 }}
              {...inputFocusHandlers}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af', display: 'flex', pointerEvents: 'none',
            }}>
              <User size={14} />
            </span>
          </div>
        </div>

        {/* Password */}
        <div>
          <label style={styles.label}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); clearError(); }}
              placeholder="Masukkan password"
              autoComplete="current-password"
              style={{ ...styles.input, paddingRight: 38 }}
              {...inputFocusHandlers}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', display: 'flex', padding: 0,
              }}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          style={styles.submitButton(isLoading)}
          onMouseEnter={e => { if (!isLoading) (e.currentTarget.style.background = '#4f46e5'); }}
          onMouseLeave={e => { if (!isLoading) (e.currentTarget.style.background = '#6366f1'); }}
        >
          {isLoading ? (
            <><LoadingSpinner /> Masuk…</>
          ) : (
            <><LogIn size={14} /> Masuk</>
          )}
        </button>

      </form>

      {/* Footer */}
      <div style={{
        marginTop: 22,
        paddingTop: 18,
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        textAlign: 'center',
        fontSize: 10,
        color: '#c4c8d0',
        fontFamily: FONT_MONO,
        letterSpacing: '0.04em',
      }}>
        {/* Default: admin / admin123 */}
      </div>

    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #f7f8fa inset !important;
          -webkit-text-fill-color: #111827 !important;
        }
      `}</style>

      <div style={styles.page}>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </div>
    </>
  );
}