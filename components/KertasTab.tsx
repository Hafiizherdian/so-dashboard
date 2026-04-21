'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Layers, Plus, Upload, Search, TrendingDown,
  TrendingUp, Package, ChevronUp, ChevronDown,
  FileSpreadsheet, X, CheckCircle, AlertCircle,
  Trash2, Pencil, Check, Filter,
} from 'lucide-react';
import { Theme, tk, FONT_MONO, FONT_SANS, CC } from '@/lib/theme';
import { apiFetch, apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }

interface KertasRow {
  id: string;
  produk: string;
  jenis_kertas: string;
  gramasi: number;
  merk: string;
  ukuran_kertas: string;
  lebar: number;
  panjang: number;
  unit: string;
  saldo_awal: number;
  masuk: number;
  keluar: number;
  saldo_akhir: number;
  periode: string; // YYYY-MM
  keterangan?: string;
  created_at: string;
}

interface KertasSummary {
  total_produk: number;
  total_masuk: number;
  total_keluar: number;
  total_saldo: number;
  jenis_list: string[];
  merk_list: string[];
}

type SortKey = 'produk' | 'saldo_akhir' | 'masuk' | 'keluar' | 'gramasi';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'chart';

const JENIS_COLORS: Record<string, string> = {
  'Art Carton': '#6366f1',
  'Art Paper': '#10b981',
  'Duplex': '#f59e0b',
  'Ivory': '#8b5cf6',
  'Kraft': '#f97316',
  'Lainnya': '#94a3b8',
};

function getJenisColor(jenis: string): string {
  return JENIS_COLORS[jenis] || CC[Object.keys(JENIS_COLORS).length % CC.length];
}

// ── Form Modal ────────────────────────────────────────────────────────────────
interface FormData {
  produk: string;
  jenis_kertas: string;
  gramasi: string;
  merk: string;
  lebar: string;
  panjang: string;
  unit: string;
  saldo_awal: string;
  masuk: string;
  keluar: string;
  periode: string;
  keterangan: string;
}

const EMPTY_FORM: FormData = {
  produk: '', jenis_kertas: '', gramasi: '', merk: '',
  lebar: '', panjang: '', unit: 'lbr',
  saldo_awal: '0', masuk: '0', keluar: '0',
  periode: new Date().toISOString().slice(0, 7),
  keterangan: '',
};

const JENIS_OPTIONS = ['Art Carton', 'Art Paper', 'Duplex', 'Ivory', 'Kraft', 'Lainnya'];
const UNIT_OPTIONS = ['lbr', 'rim', 'kg', 'rol'];

function FormModal({
  theme, mode, initial, onClose, onSaved,
}: {
  theme: Theme;
  mode: 'create' | 'edit';
  initial?: KertasRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = tk[theme];
  const [form, setForm] = useState<FormData>(() =>
    initial ? {
      produk: initial.produk,
      jenis_kertas: initial.jenis_kertas,
      gramasi: String(initial.gramasi),
      merk: initial.merk,
      lebar: String(initial.lebar),
      panjang: String(initial.panjang),
      unit: initial.unit,
      saldo_awal: String(initial.saldo_awal),
      masuk: String(initial.masuk),
      keluar: String(initial.keluar),
      periode: initial.periode,
      keterangan: initial.keterangan || '',
    } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 7,
    background: t.inputBg, border: `1px solid ${t.borderInput}`,
    color: t.text, outline: 'none', fontFamily: FONT_MONO,
  };
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };
  const lbl: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: t.textMuted,
    fontFamily: FONT_MONO, textTransform: 'uppercase',
    letterSpacing: '0.08em', display: 'block', marginBottom: 4,
  };

  // Auto-generate produk name
  useEffect(() => {
    if (mode === 'create' && form.jenis_kertas && form.gramasi && form.merk && form.lebar && form.panjang) {
      const name = `KERTAS ${form.jenis_kertas.toUpperCase()} ${form.merk.toUpperCase()} ${form.gramasi}GR × ${form.lebar}CM × ${form.panjang}CM`;
      setForm(f => ({ ...f, produk: name }));
    }
  }, [form.jenis_kertas, form.gramasi, form.merk, form.lebar, form.panjang, mode]);

  const handleSave = async () => {
    if (!form.produk || !form.jenis_kertas || !form.gramasi || !form.periode) {
      setErr('Produk, jenis kertas, gramasi, dan periode wajib diisi'); return;
    }
    setSaving(true); setErr('');
    try {
      const body = {
        ...form,
        gramasi: Number(form.gramasi),
        lebar: Number(form.lebar),
        panjang: Number(form.panjang),
        saldo_awal: Number(form.saldo_awal),
        masuk: Number(form.masuk),
        keluar: Number(form.keluar),
      };
      const url = mode === 'edit' ? `/api/kertas?id=${initial!.id}` : '/api/kertas';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const r = await apiJson(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.success) { onSaved(); onClose(); }
      else setErr(r.error || 'Gagal menyimpan');
    } catch { setErr('Koneksi gagal'); }
    finally { setSaving(false); }
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
    >
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>
            {mode === 'create' ? '+ Tambah Stok Kertas' : `Edit — ${initial?.produk?.slice(0, 30)}…`}
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
            <X size={12} />
          </button>
        </div>

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, marginBottom: 14, background: t.negBg, border: `1px solid ${t.negBorder}`, color: t.negText, fontSize: 11, fontFamily: FONT_MONO }}>
            <AlertCircle size={12} />{err}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Jenis + Gramasi + Merk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Jenis Kertas *</label>
              <select style={sel} value={form.jenis_kertas} onChange={e => setForm(f => ({ ...f, jenis_kertas: e.target.value }))}>
                <option value="">Pilih jenis…</option>
                {JENIS_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Gramasi *</label>
              <input style={inp} type="number" placeholder="230" value={form.gramasi} onChange={e => setForm(f => ({ ...f, gramasi: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Merk *</label>
              <input style={inp} type="text" placeholder="Pindodeli" value={form.merk} onChange={e => setForm(f => ({ ...f, merk: e.target.value }))} />
            </div>
          </div>

          {/* Row 2: L x P x Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.7fr', gap: 10 }}>
            <div>
              <label style={lbl}>Lebar (cm)</label>
              <input style={inp} type="number" step="0.01" placeholder="79" value={form.lebar} onChange={e => setForm(f => ({ ...f, lebar: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Panjang (cm)</label>
              <input style={inp} type="number" step="0.01" placeholder="109" value={form.panjang} onChange={e => setForm(f => ({ ...f, panjang: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Unit</label>
              <select style={sel} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Nama Produk (auto-generated, bisa edit) */}
          <div>
            <label style={lbl}>Nama Produk *</label>
            <input style={inp} type="text" placeholder="Nama produk otomatis atau isi manual" value={form.produk} onChange={e => setForm(f => ({ ...f, produk: e.target.value }))} />
          </div>

          {/* Row 3: Saldo Awal + Masuk + Keluar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Saldo Awal</label>
              <input style={inp} type="number" value={form.saldo_awal} onChange={e => setForm(f => ({ ...f, saldo_awal: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Masuk</label>
              <input style={inp} type="number" value={form.masuk} onChange={e => setForm(f => ({ ...f, masuk: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Keluar</label>
              <input style={inp} type="number" value={form.keluar} onChange={e => setForm(f => ({ ...f, keluar: e.target.value }))} />
            </div>
          </div>

          {/* Saldo Akhir (computed) */}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: t.card2bg, border: `1px solid ${t.card2border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: t.textSub, fontFamily: FONT_MONO }}>Saldo Akhir (otomatis)</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: t.card2text, fontFamily: FONT_MONO }}>
              {(Number(form.saldo_awal) + Number(form.masuk) - Number(form.keluar)).toLocaleString('id-ID')} {form.unit}
            </span>
          </div>

          {/* Periode + Keterangan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <div>
              <label style={lbl}>Periode *</label>
              <input style={inp} type="month" value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Keterangan</label>
              <input style={inp} type="text" placeholder="Opsional…" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: saving ? t.inputBg : '#6366f1', color: saving ? t.textMuted : '#fff', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Menyimpan…' : <><Check size={12} />Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ theme, onClose, onUploaded }: { theme: Theme; onClose: () => void; onUploaded: () => void }) {
  const t = tk[theme];
  const [file, setFile] = useState<File | null>(null);
  const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7));
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setMsg({ type: 'err', text: 'Format tidak didukung (.xlsx, .xls, .csv)' }); return; }
    setFile(f); setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('periode', periode);
    try {
      const r = await apiJson('/api/kertas/upload', { method: 'POST', body: fd });
      if (r.success) {
        setMsg({ type: 'ok', text: `Berhasil import ${r.count?.toLocaleString('id-ID') ?? 0} records` });
        setTimeout(() => { onUploaded(); onClose(); }, 1200);
      } else {
        setMsg({ type: 'err', text: r.error || 'Upload gagal' });
      }
    } catch { setMsg({ type: 'err', text: 'Koneksi gagal' }); }
    finally { setUploading(false); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text, outline: 'none', fontFamily: FONT_MONO };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 22, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>Upload Excel Alokasi Kertas</div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}><X size={12} /></button>
        </div>

        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 7, marginBottom: 14, background: msg.type === 'ok' ? t.posBg : t.negBg, border: `1px solid ${msg.type === 'ok' ? t.posBorder : t.negBorder}`, color: msg.type === 'ok' ? t.posText : t.negText, fontSize: 11, fontFamily: FONT_MONO }}>
            {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{msg.text}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: t.textMuted, marginBottom: 4, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Periode *</label>
          <input style={inp} type="month" value={periode} onChange={e => setPeriode(e.target.value)} />
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => !file && inputRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? '#6366f1' : file ? t.posBorder : t.borderInput}`, borderRadius: 10, padding: file ? 12 : 24, textAlign: 'center', background: dragging ? 'rgba(99,102,241,0.06)' : file ? t.posBg : t.inputBg, cursor: file ? 'default' : 'pointer', transition: 'all 0.15s', marginBottom: 14 }}
        >
          {!file ? (
            <>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: t.inputBg, border: `1.5px dashed ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}><Upload size={16} color={dragging ? '#6366f1' : t.textMuted} /></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{dragging ? 'Lepaskan di sini' : 'Drag & drop atau klik'}</div>
              <div style={{ fontSize: 10, color: t.textMuted }}>Format kolom: Produk, Jenis Kertas, Gramasi, Merk, L, P, Unit, Saldo Awal, Masuk, Keluar</div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.posBg, border: `1px solid ${t.posBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileSpreadsheet size={14} color={t.posText} /></div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{file.name}</div>
                <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ width: 22, height: 22, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={10} color={t.negText} /></button>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
          <button onClick={handleUpload} disabled={!file || uploading} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: file && !uploading ? '#6366f1' : t.inputBg, color: file && !uploading ? '#fff' : t.textMuted, cursor: file && !uploading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
            {uploading ? (<><svg style={{ animation: 'spin 0.8s linear infinite', width: 12, height: 12 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" /></svg>Mengupload…</>) : <><Upload size={12} />Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KertasTab({ theme }: Props) {
  const t = tk[theme];

  const [rows, setRows] = useState<KertasRow[]>([]);
  const [summary, setSummary] = useState<KertasSummary>({ total_produk: 0, total_masuk: 0, total_keluar: 0, total_saldo: 0, jenis_list: [], merk_list: [] });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('all');
  const [filterMerk, setFilterMerk] = useState('all');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('produk');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [modal, setModal] = useState<'create' | 'edit' | 'upload' | 'delete' | null>(null);
  const [selected, setSelected] = useState<KertasRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterJenis !== 'all') p.set('jenis_kertas', filterJenis);
      if (filterMerk !== 'all') p.set('merk', filterMerk);
      if (filterPeriode !== 'all') p.set('periode', filterPeriode);
      const [dataRes, sumRes] = await Promise.all([
        apiJson(`/api/kertas?${p}`),
        apiJson('/api/kertas/summary'),
      ]);
      if (dataRes.success) setRows(dataRes.data);
      if (sumRes.success) setSummary(sumRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterJenis, filterMerk, filterPeriode]);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const r = await apiJson(`/api/kertas?id=${selected.id}`, { method: 'DELETE' });
      if (r.success) { showToast('ok', 'Data berhasil dihapus'); setModal(null); await load(); }
      else showToast('err', r.error || 'Gagal menghapus');
    } finally { setDeleting(false); }
  };

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const periodeList = Array.from(new Set(rows.map(r => r.periode))).sort().reverse();

  const filtered = rows
    .filter(r => {
      if (search && !r.produk.toLowerCase().includes(search.toLowerCase()) && !r.merk.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  // Chart data: stok per jenis kertas
  const jenisSet = [...new Set(filtered.map(r => r.jenis_kertas))];

const chartData = jenisSet.map(jenis => {
  const items = filtered.filter(r => r.jenis_kertas === jenis);

  return {
    jenis,
    saldo: items.reduce((s, r) => s + Number(r.saldo_akhir || 0), 0),
masuk: items.reduce((s, r) => s + Number(r.masuk || 0), 0),
keluar: items.reduce((s, r) => s + Number(r.keluar || 0), 0),
    color: getJenisColor(jenis),
  };
});
const summaryLocal = {
  total_produk: filtered.length,
  total_masuk: filtered.reduce((s, r) => s + Number(r.masuk || 0), 0),
  total_keluar: filtered.reduce((s, r) => s + Number(r.keluar || 0), 0),
  total_saldo: filtered.reduce((s, r) => s + Number(r.saldo_akhir || 0), 0),
};

  const SortIcon = ({ k }: { k: SortKey }) =>
    k === sortKey
      ? (sortDir === 'asc' ? <ChevronUp size={10} color="#6366f1" /> : <ChevronDown size={10} color="#6366f1" />)
      : <ChevronUp size={10} color={t.textFaint} />;

  const thS: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted,
    borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO,
    background: t.tableHead, whiteSpace: 'nowrap',
  };

  const selS: React.CSSProperties = {
    height: 28, padding: '0 8px', fontSize: 11, borderRadius: 6,
    background: t.inputBg, border: `1px solid ${t.borderInput}`,
    color: t.text, outline: 'none', fontFamily: FONT_MONO, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: t.cardbg, border: `1px solid ${toast.type === 'ok' ? t.posBorder : t.negBorder}`, color: toast.type === 'ok' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'ok' ? <Check size={13} /> : <X size={13} />}{toast.text}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Produk Kertas', value: summaryLocal.total_produk.toLocaleString('id-ID'), sub: `${jenisSet.length} jenis`, color: t.card1text, bg: t.card1bg, border: t.card1border, icon: <Package size={14} /> },
          { label: 'Total Saldo Stok', value: summaryLocal.total_saldo.toLocaleString('id-ID'), sub: 'lembar/unit', color: t.card2text, bg: t.card2bg, border: t.card2border, icon: <Layers size={14} /> },
          { label: 'Total Masuk', value: summaryLocal.total_masuk.toLocaleString('id-ID'), sub: 'unit diterima', color: '#10b981', bg: t.card2bg, border: t.card2border, icon: <TrendingUp size={14} /> },
          { label: 'Total Keluar', value: summaryLocal.total_keluar.toLocaleString('id-ID'), sub: 'unit digunakan', color: t.card4text, bg: t.card4bg, border: t.card4border, icon: <TrendingDown size={14} /> },
        ].map(card => (
          <div key={card.label} style={{ borderRadius: 13, padding: '14px 16px', background: card.bg, border: `1px solid ${card.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700 }}>{card.label}</span>
              <span style={{ color: card.color, opacity: 0.6 }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 9.5, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 5 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Chart (stok per jenis) ── */}
      {chartData.length > 0 && (
        <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, padding: '12px 14px', boxShadow: t.shadowCard }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={11} color="#818cf8" /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Saldo Stok per Jenis Kertas</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} vertical={false} />
              <XAxis dataKey="jenis" tick={{ fontSize: 9, fill: t.textMuted, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v)} tick={{ fontSize: 9, fill: t.textMuted, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 8, fontSize: 11, fontFamily: FONT_MONO }}
                labelStyle={{ color: t.text, fontWeight: 700 }}
                itemStyle={{ color: t.textSub }}
                formatter={(v: any) => v.toLocaleString('id-ID')}
              />
              <Bar dataKey="saldo" name="Saldo Akhir" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Left: icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={12} color="#818cf8" /></div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Alokasi Kertas</div>
              <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{filtered.length} item</div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            <Filter size={11} color={t.textMuted} />
            <select style={selS} value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)}>
              <option value="all">Semua Periode</option>
              {periodeList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select style={selS} value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
              <option value="all">Semua Jenis</option>
              {summary.jenis_list.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <select style={selS} value={filterMerk} onChange={e => setFilterMerk(e.target.value)}>
              <option value="all">Semua Merk</option>
              {summary.merk_list.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: '0 0 auto' }}>
            <Search size={11} color={t.textMuted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" placeholder="Cari produk…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 28, paddingLeft: 26, paddingRight: 10, fontSize: 11, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text, outline: 'none', width: 160, fontFamily: FONT_MONO }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
            <button onClick={() => setModal('upload')} style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT_MONO }}>
              <Upload size={11} />Upload
            </button>
            <button onClick={() => { setSelected(null); setModal('create'); }} style={{ height: 28, padding: '0 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT_MONO, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
              <Plus size={11} />Tambah
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {/* <th style={{ ...thS, cursor: 'pointer' }} onClick={() => toggleSort('produk')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Produk <SortIcon k="produk" /></span>
                </th> */}
                <th style={thS}>Merk</th>
                <th style={thS}>Jenis</th>
                <th style={{ ...thS, cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('gramasi')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Gramasi <SortIcon k="gramasi" /></span>
                </th>
                
                <th style={{ ...thS, textAlign: 'right' }}>Ukuran (L×P)</th>
                <th style={thS}>Unit</th>
                <th style={{ ...thS, textAlign: 'right' }}>Saldo Awal</th>
                <th style={{ ...thS, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('masuk')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Masuk <SortIcon k="masuk" /></span>
                </th>
                <th style={{ ...thS, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('keluar')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Keluar <SortIcon k="keluar" /></span>
                </th>
                <th style={{ ...thS, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('saldo_akhir')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Saldo Akhir <SortIcon k="saldo_akhir" /></span>
                </th>
                <th style={{ ...thS, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 28, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 11 }}>Memuat data…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 28, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 11 }}>Belum ada data alokasi kertas</td></tr>
              ) : filtered.map((row, i) => {
                const jenisColor = getJenisColor(row.jenis_kertas);
                const isLow = row.saldo_akhir < row.saldo_awal * 0.2 && row.saldo_awal > 0;
                return (
                  <tr key={row.id}
                    style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                  >
                    {/* <td style={{ padding: '8px 10px', color: t.text, fontFamily: FONT_MONO, fontSize: 10, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.produk}
                    </td> */}
                    <td style={{ padding: '8px 10px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.merk}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: jenisColor + '18', color: jenisColor, border: `1px solid ${jenisColor}30` }}>
                        {row.jenis_kertas}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.gramasi} gr</td>
                    
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10 }}>
                      {row.lebar} × {row.panjang}
                    </td>
                    <td style={{ padding: '8px 10px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10 }}>{row.unit}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 11 }}>
                      {row.saldo_awal.toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: 11, color: row.masuk > 0 ? '#10b981' : t.textMuted }}>
                      {row.masuk > 0 ? `+${row.masuk.toLocaleString('id-ID')}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: FONT_MONO, fontSize: 11, color: row.keluar > 0 ? t.negText : t.textMuted }}>
                      {Math.abs(row.keluar) > 0 ? `(${row.keluar.toLocaleString('id-ID')})` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: FONT_MONO, color: isLow ? t.negText : t.card2text }}>
                        {row.saldo_akhir.toLocaleString('id-ID')}
                      </span>
                      {isLow && <span style={{ marginLeft: 4, fontSize: 9, color: t.negText }}>⚠</span>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button onClick={() => { setSelected(row); setModal('edit'); }} style={{ width: 26, height: 26, borderRadius: 6, background: t.infoBg, border: `1px solid ${t.infoBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Pencil size={10} color={t.infoText} />
                        </button>
                        <button onClick={() => { setSelected(row); setModal('delete'); }} style={{ width: 26, height: 26, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={10} color={t.negText} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {(modal === 'create' || modal === 'edit') && (
        <FormModal
          theme={theme}
          mode={modal}
          initial={modal === 'edit' ? selected! : undefined}
          onClose={() => setModal(null)}
          onSaved={() => { load(); showToast('ok', modal === 'create' ? 'Data berhasil ditambahkan' : 'Data berhasil diperbarui'); }}
        />
      )}

      {modal === 'upload' && (
        <UploadModal theme={theme} onClose={() => setModal(null)} onUploaded={() => { load(); showToast('ok', 'Data berhasil diimport'); }} />
      )}

      {modal === 'delete' && selected && (
        <div onClick={e => e.target === e.currentTarget && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 22, width: '100%', maxWidth: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={16} color={t.negText} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus Data</div>
                <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.6 }}>Yakin menghapus <strong>"{selected.produk.slice(0, 40)}…"</strong>?</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModal(null)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}