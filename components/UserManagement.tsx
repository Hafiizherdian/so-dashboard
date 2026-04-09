'use client';
import { apiFetch, apiJson } from '@/lib/apiFetch';
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';
import { Theme, tk, FONT_MONO, FONT_SANS } from '@/lib/theme';
import { useAuth } from '@/lib/AuthContext';

type Role = 'root' | 'admin' | 'user';
interface User { id: number; username: string; role: Role; areas: string[]; created_at: string; }

const ROLE_CFG: Record<Role, { label: string; Icon: any; color: string; bg: string; border: string }> = {
  root:  { label: 'Root',  Icon: ShieldAlert, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  admin: { label: 'Admin', Icon: ShieldCheck, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)'  },
  user:  { label: 'User',  Icon: Shield,      color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)'  },
};

interface Props { theme: Theme; }

export default function UserManagement({ theme }: Props) {
  const t = tk[theme];
  const { user: me } = useAuth();
  const isRoot = me?.role === 'root';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' as Role, areas: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiJson('/api/users');
      if (r.success) setUsers(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openCreate = () => {
    setForm({ username: '', password: '', role: 'user', areas: '' });
    setShowPw(false);
    setModal('create');
  };

  const openEdit = (u: User) => {
    setSelected(u);
    setForm({ username: u.username, password: '', role: u.role, areas: (u.areas || []).join(', ') });
    setShowPw(false);
    setModal('edit');
  };

  const openDelete = (u: User) => { setSelected(u); setModal('delete'); };

  const handleSave = async () => {
    if (!form.username) { showToast('err', 'Username wajib diisi'); return; }
    if (modal === 'create' && !form.password) { showToast('err', 'Password wajib untuk user baru'); return; }
    setSaving(true);
    try {
      const areas = form.areas ? form.areas.split(',').map(s => s.trim()).filter(Boolean) : [];
      const body = modal === 'edit'
        ? { id: selected!.id, username: form.username, password: form.password || undefined, role: form.role, areas }
        : { username: form.username, password: form.password, role: form.role, areas };

      const r = await apiFetch('/api/users', {
        method: modal === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (r.success) {
        showToast('ok', modal === 'edit' ? 'User berhasil diperbarui' : 'User berhasil dibuat');
        setModal(null);
        await loadUsers();
      } else {
        showToast('err', r.error || 'Gagal menyimpan');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const r = await apiJson(`/api/users?id=${selected.id}`, { method: 'DELETE' });
      if (r.success) {
        showToast('ok', `User "${selected.username}" dihapus`);
        setModal(null);
        await loadUsers();
      } else {
        showToast('err', r.error || 'Gagal menghapus');
      }
    } finally { setDeleting(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8,
    background: t.inputBg, border: `1px solid ${t.borderInput}`,
    color: t.text, outline: 'none', fontFamily: FONT_MONO, transition: 'border-color 0.15s',
  };

  const thS: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.09em', color: t.textMuted,
    borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: t.cardbg, border: `1px solid ${toast.type === 'ok' ? t.posBorder : t.negBorder}`, color: toast.type === 'ok' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease' }}>
          {toast.type === 'ok' ? <Check size={13} /> : <X size={13} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={14} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Manajemen User</div>
            <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{users.length} akun terdaftar</div>
          </div>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: FONT_MONO, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
          <Plus size={13} /> Tambah User
        </button>
      </div>

      {/* Table */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 580, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thS}>Username</th>
                <th style={thS}>Role</th>
                <th style={thS}>Area Akses</th>
                <th style={thS}>Dibuat</th>
                <th style={{ ...thS, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>Memuat…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>Belum ada user</td></tr>
              ) : users.map((u, i) => {
                const rc = ROLE_CFG[u.role];
                const RIcon = rc.Icon;
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <RIcon size={13} color={rc.color} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT_MONO }}>{u.username}</div>
                          {isSelf && <div style={{ fontSize: 9, color: '#818cf8', fontFamily: FONT_MONO }}>(kamu)</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>{rc.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: t.textSub, fontFamily: FONT_MONO }}>
                      {(u.areas || []).length > 0 ? (u.areas || []).slice(0, 3).join(', ') + ((u.areas || []).length > 3 ? ` +${(u.areas || []).length - 3}` : '') : <span style={{ color: t.textFaint }}>Semua area</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO, whiteSpace: 'nowrap' }}>
                      {new Date(u.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
                        <button onClick={() => openEdit(u)} style={{ width: 28, height: 28, borderRadius: 7, background: t.infoBg, border: `1px solid ${t.infoBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Pencil size={11} color={t.infoText} />
                        </button>
                        {isRoot && !isSelf && (
                          <button onClick={() => openDelete(u)} style={{ width: 28, height: 28, borderRadius: 7, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Trash2 size={11} color={t.negText} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', animation: 'slideUp 0.2s ease' }}>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{modal === 'create' ? 'Tambah User Baru' : `Edit User — ${selected?.username}`}</div>
              <button onClick={() => setModal(null)} style={{ width: 26, height: 26, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}><X size={12} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Username */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Username</label>
                <input style={inp} type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username…" />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Password {modal === 'edit' && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(kosongkan jika tidak diubah)</span>}</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 38 }} type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={modal === 'edit' ? 'Kosongkan jika tidak diubah' : 'Password baru…'} />
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 2 }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Role</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['user', 'admin', ...(isRoot ? ['root'] : [])] as Role[]).map(r => {
                    const rc = ROLE_CFG[r];
                    const active = form.role === r;
                    return (
                      <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: `1px solid ${active ? rc.border : t.borderInput}`, background: active ? rc.bg : t.inputBg, cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 400, color: active ? rc.color : t.textSub, fontFamily: FONT_MONO, transition: 'all 0.15s' }}>
                        <rc.Icon size={11} color={active ? rc.color : t.textMuted} />
                        {rc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Areas */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Akses Area <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(pisahkan koma, kosong = semua)</span></label>
                <input style={inp} type="text" value={form.areas} onChange={e => setForm(f => ({ ...f, areas: e.target.value }))} placeholder="Contoh: Jawa Timur, Jawa Tengah" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: saving ? t.inputBg : '#6366f1', color: saving ? t.textMuted : '#fff', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(99,102,241,0.3)' }}>
                {saving ? 'Menyimpan…' : modal === 'create' ? 'Buat User' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {modal === 'delete' && selected && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} color={t.negText} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus User</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>Yakin menghapus user <strong>"{selected.username}"</strong>? Tindakan ini tidak bisa dibatalkan.</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Menghapus…' : 'Hapus User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
