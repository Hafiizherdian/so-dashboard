'use client';
import { apiFetch, apiJson } from '@/lib/apiFetch';
import React, { useState, useMemo } from 'react';
import { Lock, Download, Eye, EyeOff, Check, X, FileSpreadsheet } from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { useAuth } from '@/lib/AuthContext';

interface Props { theme: Theme; currentFilters?: Record<string, string>; }

function PasswordForm({ theme }: { theme: Theme }) {
  const t = tk[theme];
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [conf, setConf] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNw, setShowNw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const strength = useMemo(() => {
    if (!nw) return 0;
    let s = 0;
    if (nw.length >= 8) s++;
    if (/[A-Z]/.test(nw)) s++;
    if (/[0-9]/.test(nw)) s++;
    if (/[^A-Za-z0-9]/.test(nw)) s++;
    return s;
  }, [nw]);
  const strengthColor = ['', t.negText, t.warnText, t.infoText, t.posText][strength];
  const strengthLabel = ['', 'Lemah', 'Cukup', 'Baik', 'Kuat'][strength];

  const handleSubmit = async () => {
    if (!cur || !nw || !conf) { setMsg({ type: 'err', text: 'Semua field wajib diisi' }); return; }
    if (nw !== conf) { setMsg({ type: 'err', text: 'Konfirmasi password tidak sesuai' }); return; }
    if (nw.length < 6) { setMsg({ type: 'err', text: 'Password minimal 6 karakter' }); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await apiFetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
      }).then(r => r.json());
      if (r.success) { setMsg({ type: 'ok', text: 'Password berhasil diubah' }); setCur(''); setNw(''); setConf(''); }
      else setMsg({ type: 'err', text: r.error || 'Gagal mengubah password' });
    } catch { setMsg({ type: 'err', text: 'Koneksi gagal' }); }
    finally { setLoading(false); }
  };

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '9px 38px 9px 12px', fontSize: 12, borderRadius: 8,
    background: t.inputBg, border: `1px solid ${t.borderInput}`,
    color: t.text, outline: 'none', fontFamily: FONT_MONO, ...extra,
  });

  const EyeBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 2 }}>
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: msg.type === 'ok' ? t.posBg : t.negBg, border: `1px solid ${msg.type === 'ok' ? t.posBorder : t.negBorder}`, color: msg.type === 'ok' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO }}>
          {msg.type === 'ok' ? <Check size={12} /> : <X size={12} />}{msg.text}
        </div>
      )}
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password Saat Ini</label>
        <div style={{ position: 'relative' }}><input style={inp()} type={showCur ? 'text' : 'password'} value={cur} onChange={e => setCur(e.target.value)} placeholder="Password lama…" /><EyeBtn show={showCur} toggle={() => setShowCur(p => !p)} /></div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password Baru</label>
        <div style={{ position: 'relative' }}><input style={inp()} type={showNw ? 'text' : 'password'} value={nw} onChange={e => setNw(e.target.value)} placeholder="Password baru…" /><EyeBtn show={showNw} toggle={() => setShowNw(p => !p)} /></div>
        {nw && <div style={{ marginTop: 7 }}><div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>{[1,2,3,4].map(l => <div key={l} style={{ flex: 1, height: 3, borderRadius: 2, background: l <= strength ? strengthColor : t.borderCard, transition: 'background 0.2s' }} />)}</div><div style={{ fontSize: 10, fontFamily: FONT_MONO, color: strengthColor, fontWeight: 600 }}>{strengthLabel}</div></div>}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Konfirmasi Password Baru</label>
        <div style={{ position: 'relative' }}><input style={inp()} type="password" value={conf} onChange={e => setConf(e.target.value)} placeholder="Ulangi password baru…" /></div>
        {conf && nw && <div style={{ marginTop: 5, fontSize: 11, fontFamily: FONT_MONO, color: conf === nw ? t.posText : t.negText, display: 'flex', alignItems: 'center', gap: 4 }}>{conf === nw ? <Check size={10} /> : <X size={10} />}{conf === nw ? 'Password cocok' : 'Tidak cocok'}</div>}
      </div>
      <button onClick={handleSubmit} disabled={loading || !cur || !nw || !conf || nw !== conf} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: (loading || !cur || !nw || !conf || nw !== conf) ? t.inputBg : '#6366f1', color: (loading || !cur || !nw || !conf || nw !== conf) ? t.textMuted : '#fff', cursor: (loading || !cur || !nw || !conf || nw !== conf) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', boxShadow: (!loading && cur && nw && conf && nw === conf) ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}>
        <Lock size={13} />{loading ? 'Menyimpan…' : 'Ubah Password'}
      </button>
    </div>
  );
}

export default function SettingsTab({ theme, currentFilters }: Props) {
  const t = tk[theme];
  const { user } = useAuth();
  const [exportType, setExportType] = useState('detail');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams({ type: exportType });
      if (currentFilters) {
        Object.entries(currentFilters).forEach(([k, v]) => {
          if (v && v !== 'all') p.set(k, v);
        });
      }
      const res = await apiFetch(`/api/export?${p}`);
      if (!res.ok) { alert('Export gagal'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${exportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const cardS: React.CSSProperties = {
    background: t.cardbg, border: `1px solid ${t.borderCard}`,
    borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard,
  };

  const hdrS: React.CSSProperties = {
    padding: '11px 15px', borderBottom: `1px solid ${t.border}`,
    display: 'flex', alignItems: 'center', gap: 8,
  };

  const EXPORT_TYPES = [
    { value: 'detail', label: 'Detail Transaksi', desc: 'Semua baris data lengkap (max 50.000)' },
    { value: 'summary', label: 'Ringkasan Bulanan', desc: 'Total per tahun / bulan / minggu' },
    { value: 'customer', label: 'Per Pelanggan', desc: 'Total per nama pelanggan' },
    { value: 'product', label: 'Per Produk', desc: 'Total per produk & kategori' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start', maxWidth: 900 }}>
      {/* Change Password */}
      <div style={cardS}>
        <div style={hdrS}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={12} color="#818cf8" /></div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Ubah Password</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{user?.username} · {user?.role}</div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <PasswordForm theme={theme} />
        </div>
      </div>

      {/* Export */}
      <div style={cardS}>
        <div style={hdrS}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Download size={12} color="#6ee7b7" /></div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Export Data Excel</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Unduh data sesuai filter aktif</div>
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {EXPORT_TYPES.map(et => (
              <button key={et.value} onClick={() => setExportType(et.value)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px', borderRadius: 8, border: `1px solid ${exportType === et.value ? 'rgba(16,185,129,0.35)' : t.borderInput}`, background: exportType === et.value ? 'rgba(16,185,129,0.08)' : t.inputBg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${exportType === et.value ? '#10b981' : t.borderInput}`, marginTop: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {exportType === et.value && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: exportType === et.value ? '#6ee7b7' : t.text, fontFamily: FONT_MONO }}>{et.label}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{et.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 11px', borderRadius: 8, background: t.infoBg, border: `1px solid ${t.infoBorder}`, fontSize: 11, color: t.infoText, fontFamily: FONT_MONO }}>
            💡 Filter aktif di dashboard akan diterapkan ke export
          </div>
          <button onClick={handleExport} disabled={exporting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, border: 'none', background: exporting ? t.inputBg : '#10b981', color: exporting ? t.textMuted : '#fff', cursor: exporting ? 'not-allowed' : 'pointer', boxShadow: exporting ? 'none' : '0 2px 10px rgba(16,185,129,0.3)', fontFamily: FONT_MONO }}>
            <FileSpreadsheet size={14} />{exporting ? 'Mengekspor…' : 'Download Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
