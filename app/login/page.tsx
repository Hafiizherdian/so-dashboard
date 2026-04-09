'use client';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, BarChart3, AlertCircle } from 'lucide-react';

function LoginForm() {
  const { login, user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect jika sudah login
  useEffect(() => {
    if (!loading && user) {
      console.log('User sudah login, redirect ke dashboard');
      window.location.href = '/';
    }
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password wajib diisi');
      return;
    }

    setIsLoading(true);
    setError('');

    const r = await login(username, password);

    if (r.success) {
      console.log('Login sukses dari form, redirect...');
      // Beri delay kecil agar cookie sempat tersimpan
      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    } else {
      setError(r.error || 'Login gagal');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"IBM Plex Sans",sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .so-inp{width:100%;padding:10px 14px;font-size:13px;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.9);outline:none;font-family:"IBM Plex Mono",monospace;transition:border-color 0.15s;box-sizing:border-box}
        .so-inp:focus{border-color:rgba(99,102,241,0.6)}
        .so-inp::placeholder{color:rgba(255,255,255,0.25)}
        .so-btn{width:100%;padding:11px;font-size:13px;font-weight:700;border-radius:9px;border:none;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;cursor:pointer;font-family:"IBM Plex Mono",monospace;transition:opacity 0.15s;box-shadow:0 4px 16px rgba(99,102,241,0.35)}
        .so-btn:hover{opacity:0.9}
        .so-btn:disabled{opacity:0.55;cursor:not-allowed}
      `}</style>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeUp 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
            <BarChart3 size={26} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.92)', fontFamily: '"IBM Plex Mono",monospace', letterSpacing: '-0.03em' }}>SO Dashboard</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: '"IBM Plex Mono",monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 5 }}>Sales · Penjualan · Outstanding</div>
        </div>

        <div style={{ background: '#0e1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 20, fontFamily: '"IBM Plex Mono",monospace' }}>Masuk ke akun Anda</div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12, fontFamily: '"IBM Plex Mono",monospace' }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontFamily: '"IBM Plex Mono",monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Username</label>
              <input 
                className="so-inp" 
                type="text" 
                placeholder="Masukkan username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                autoComplete="username"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontFamily: '"IBM Plex Mono",monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="so-inp" 
                  type={showPw ? 'text' : 'password'} 
                  placeholder="Masukkan password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  autoComplete="current-password" 
                  style={{ paddingRight: 40 }} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPw(p => !p)} 
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 2 }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button className="so-btn" type="submit" disabled={isLoading} style={{ marginTop: 4 }}>
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg style={{ animation: 'spin 0.8s linear infinite', width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Masuk…
                </span>
              ) : 'Masuk'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: '"IBM Plex Mono",monospace' }}>
          Default: admin / admin123
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}