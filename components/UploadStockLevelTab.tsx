'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, 
  Trash2, List, Calendar, Eye 
} from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

// Types
interface Props { theme: Theme; }
type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface StockLevelUploadRow {
  id: string;
  file_name: string;
  periode_awal: string;
  periode_akhir: string;
  created_at: string;
  row_count: number;
  status?: 'completed' | 'processing' | 'error';
}

interface JenisEtiketSummary {
  [jenis: string]: number;
}

const FORMAT_COLS = [
  'Kode Pabrik', 'Kode Brand', 'Etiket [deskripsi]', 'Stok Pabrik [tgl]',
  'Pengiriman SSS [range]', 'Stok Aktual [tgl]', 'WIP [tgl]', 'BJ [tgl]',
  'Kiriman', 'Plan Produksi', 'Keterangan',
];

const JENIS_ETIKET_COLORS: Record<string, string> = {
  UV: '#6366f1',
  Konven: '#f59e0b',
  Dos: '#10b981',
  'Slop Dos': '#14b8a6',
  Etiket: '#8b5cf6',
};
const JENIS_ETIKET_ORDER = ['UV', 'Konven', 'Dos', 'Slop Dos', 'Etiket'];

const ACCEPTED_EXTS = /\.(xlsx|xls)$/i;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Sub Components

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '11px 14px', fontSize: 11, color: t.text, fontFamily: FONT_MONO, lineHeight: 1.8 }}>
      <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileSpreadsheet size={14} /> Format Kolom Stock Level Pabrik:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
          {FORMAT_COLS.map((col) => (
            <span key={col} style={{ padding: '2px 8px', borderRadius: 5, background: t.cardbg, border: `1px solid ${t.borderInput}`, fontSize: 10, color: t.textSub }}>
              {col}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: t.textMuted }}>
          * Upload ulang pada periode yang sama otomatis mengupdate data (kode pabrik + kode brand).
        </div>
      </div>
    </div>
  );
}

function JenisEtiketBadges({ summary, t }: { summary: JenisEtiketSummary; t: Tokens }) {
  const keys = [
    ...JENIS_ETIKET_ORDER.filter((k) => summary[k] !== undefined),
    ...Object.keys(summary).filter((k) => !JENIS_ETIKET_ORDER.includes(k)),
  ];
  if (keys.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {keys.map((k) => (
        <span
          key={k}
          style={{
            padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
            background: `${JENIS_ETIKET_COLORS[k] ?? t.textMuted}1a`,
            color: JENIS_ETIKET_COLORS[k] ?? t.textSub,
            border: `1px solid ${JENIS_ETIKET_COLORS[k] ?? t.borderInput}55`,
          }}
        >
          {k}: {summary[k]}
        </span>
      ))}
    </div>
  );
}

// Preview Panel Data
const PreviewPanel = React.memo(function PreviewPanel({ fileId, fileName, t }: { fileId: string; fileName: string; t: Tokens; }) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allCols, setAllCols] = useState<string[]>([]);
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true); setError(''); setData([]); setAllCols([]); setActiveCols(new Set());
    
    apiJson(`/api/stock-level-pabrik/${fileId}/preview`)
      .then(r => {
        if (r.success && r.data?.length) {
          const cols = Object.keys(r.data[0]);
          setAllCols(cols);
          setActiveCols(new Set(cols));
          setData(r.data);
        } else { setError(r.error || 'Tidak ada data preview'); }
      })
      .catch(() => setError('Gagal memuat preview'))
      .finally(() => setLoading(false));
  }, [fileId]);

  const numericCols = useMemo(() => allCols.filter(c => data.every(row => {
    const v = row[c]; return v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  })), [data, allCols]);

  const isNumericCell = (col: string, val: unknown) =>
    numericCols.includes(col) && val !== '' && val !== null && !isNaN(Number(val));

  const fmtCell = (col: string, val: unknown): string => {
    if (val === null || val === undefined || val === '') return '—';
    if (isNumericCell(col, val)) return Number(val).toLocaleString('id-ID');
    return String(val);
  };

  const toggleCol = useCallback((col: string) => {
    setActiveCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) { if (next.size > 2) next.delete(col); }
      else next.add(col);
      return next;
    });
  }, []);

  const visibleCols = allCols.filter(c => activeCols.has(c));

  if (loading) return <div style={{ padding: '14px 16px', color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>Memuat preview…</div>;
  if (error) return <div style={{ padding: '10px 13px', borderRadius: 8, background: t.negBg, border: `1px solid ${t.negBorder}`, color: t.negText, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}><AlertCircle size={12} />{error}</div>;
  if (!data.length) return <div style={{ padding: 28, textAlign: 'center', color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>Tidak ada data.</div>;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.cardbg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: t.tableHead, borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: t.posBg, border: `1px solid ${t.posBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSpreadsheet size={12} color={t.posText} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>{fileName}</div>
            <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 1 }}>{data.length} baris · {allCols.length} kolom</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, flexShrink: 0 }}>preview 10 baris</span>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '8px 12px', borderBottom: `1px solid ${t.border}`, background: t.tableHead }}>
        {allCols.map(col => {
          const on = activeCols.has(col);
          return (
            <button key={col} onClick={() => toggleCol(col)}
              style={{ fontSize: 10, fontFamily: FONT_MONO, padding: '2px 9px', borderRadius: 12, border: `1px solid ${on ? '#6366f1' : t.border}`, background: on ? 'rgba(99,102,241,0.1)' : t.inputBg, color: on ? '#818cf8' : t.textMuted, cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' }}>
              {col}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {visibleCols.map(col => (
                <th key={col} style={{ position: 'sticky', top: 0, zIndex: 2, padding: '7px 12px', textAlign: numericCols.includes(col) ? 'right' : 'left', fontSize: 9, fontWeight: 700, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, background: t.tableHead, whiteSpace: 'nowrap' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                {visibleCols.map(col => {
                  const numeric = isNumericCell(col, row[col]);
                  return (
                    <td key={col} style={{ padding: '6px 12px', color: numeric ? t.text : t.textSub, fontFamily: FONT_MONO, borderBottom: i < data.length - 1 ? `1px solid ${t.border}` : 'none', whiteSpace: 'nowrap', fontWeight: numeric ? 600 : 400, textAlign: numeric ? 'right' : 'left', fontSize: 12 }}>
                      {fmtCell(col, row[col])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// Modal Preview
function PreviewModal({ file, onClose, t }: { file: StockLevelUploadRow; onClose: () => void; t: Tokens }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, width: '100%', maxWidth: 1000, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.border}`, background: t.tableHead, flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#6366f115', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={15} color="#6366f1" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview Data Stock Level Pabrik</div>
              <div style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>{file.file_name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={14} color={t.negText} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <PreviewPanel fileId={file.id} fileName={file.file_name} t={t} />
        </div>
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${t.border}`, background: t.tableHead, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// MAIN EXPORT COMPONENT
export default function UploadStockLevelTab({ theme }: Props) {
  const t = tk[theme];

  const [file, setFile] = useState<File | null>(null);
  const [periodeAwal, setPeriodeAwal] = useState('');
  const [periodeAkhir, setPeriodeAkhir] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<MsgState>(null);
  const [lastSummary, setLastSummary] = useState<JenisEtiketSummary | null>(null);

  const [uploads, setUploads] = useState<StockLevelUploadRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [delTarget, setDelTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewFile, setPreviewFile] = useState<StockLevelUploadRow | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Responsiveness mobile layout swap
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const r = await apiJson('/api/stock-level-pabrik/upload');
    if (r.success) setUploads(r.data ?? []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const sortedUploads = useMemo(
    () => [...uploads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [uploads],
  );

  const handleFile = (f: File) => {
    if (!ACCEPTED_EXTS.test(f.name)) { setMsg({ type: 'err', text: 'Format tidak didukung (.xlsx, .xls)' }); return; }
    setFile(f); setMsg(null);
  };

  const canUpload = !!file && !!periodeAwal && !!periodeAkhir && !uploading;

  const handleUpload = async () => {
    if (!canUpload || !file) return;
    setUploading(true);
    setMsg(null);
    setLastSummary(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('periode_awal', periodeAwal);
    fd.append('periode_akhir', periodeAkhir);

    try {
      const r = await apiJson('/api/stock-level-pabrik/upload', { method: 'POST', body: fd });

      if (r.success) {
        setMsg({ type: 'ok', text: `Berhasil import ${r.data.row_count} baris (periode ${fmtDate(r.data.periode_awal)} - ${fmtDate(r.data.periode_akhir)})` });
        setLastSummary(r.data.jenis_etiket_summary ?? null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        await loadHistory();
      } else {
        setMsg({ type: 'err', text: r.error || 'Upload gagal' });
      }
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Koneksi gagal' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    await apiJson(`/api/stock-level-pabrik/upload?id=${delTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDelTarget(null);
    await loadHistory();
  };

  const dateInp: React.CSSProperties = {
    padding: '8px 10px', fontSize: 12, borderRadius: 8, background: t.inputBg,
    border: `1px solid ${t.borderInput}`, color: t.text, outline: 'none', fontFamily: FONT_MONO, width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} t={t} />}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch', width: '100%' }}>
        
        {/* BOX UPLOAD */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 2 : 1, background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={12} color={t.text} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload Stock Level Pabrik</div>
          </div>

          <div style={{ padding: 16 }}>
            {msg && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontSize: 12, fontFamily: FONT_MONO }}>
                  {msg.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {msg.text}
                  <button onClick={() => { setMsg(null); setLastSummary(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={11} /></button>
                </div>
                {msg.type === 'ok' && lastSummary && <JenisEtiketBadges summary={lastSummary} t={t} />}
              </div>
            )}

            {/* Periode */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Calendar size={11} /> Periode Awal
                </label>
                <input type="date" value={periodeAwal} onChange={e => setPeriodeAwal(e.target.value)} style={dateInp} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Calendar size={11} /> Periode Akhir
                </label>
                <input type="date" value={periodeAkhir} onChange={e => setPeriodeAkhir(e.target.value)} style={dateInp} />
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => !file && inputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#6366f1' : file ? t.border : t.borderInput}`, borderRadius: 10, padding: file ? 14 : 28, textAlign: 'center', background: dragging ? 'rgba(99,102,241,0.06)' : t.inputBg, cursor: file ? 'default' : 'pointer', transition: 'all 0.15s', marginBottom: 14 }}
            >
              {!file ? (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: t.cardbg, border: `1.5px dashed ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Upload size={18} color={dragging ? '#6366f1' : t.textMuted} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{dragging ? 'Lepaskan di sini' : 'Drag & drop atau klik file'}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>Mendukung .xlsx · .xls</div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: t.cardbg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileSpreadsheet size={16} color={t.text} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ width: 24, height: 24, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <X size={11} color={t.negText} />
                  </button>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

            {!periodeAwal || !periodeAkhir ? (
              <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginBottom: 10 }}>* Isi periode awal & akhir sebelum upload.</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleUpload}
                disabled={!canUpload}
                style={{
                  width: '100%', height: 37, padding: '0 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none',
                  background: canUpload ? '#6366f1' : t.inputBg,
                  color: canUpload ? '#fff' : t.textMuted,
                  cursor: canUpload ? 'pointer' : 'not-allowed',
                  fontFamily: FONT_MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {uploading ? (
                  <><svg style={{ animation: 'spin 0.8s linear infinite', width: 12, height: 12 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" /></svg>Mengupload…</>
                ) : (
                  <><Upload size={12} /> Upload Data</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* FORMAT GUIDE */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 1 : 2, overflow: 'hidden', display: 'flex' }}>
          <FormatGuide t={t} />
        </div>
      </div>

      {/* BOX HISTORI */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <List size={12} color={t.text} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Riwayat Upload Stock Level</div>
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginLeft: 'auto' }}>{sortedUploads.length} file</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 650, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['File', 'Periode', 'Baris', 'Diupload', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Aksi' ? 'center' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>Memuat...</td></tr>
              ) : sortedUploads.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>Belum ada data upload</td></tr>
              ) : sortedUploads.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                  <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11, whiteSpace: 'nowrap' }}>
                    {fmtDate(f.periode_awal)} — {fmtDate(f.periode_akhir)}
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                    {(f.row_count ?? 0).toLocaleString('id-ID')} baris
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {new Date(f.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
                      <button onClick={() => setPreviewFile(f)} disabled={f.status === 'error'} style={{ width: 26, height: 26, borderRadius: 6, background: '#6366f115', border: '1px solid #6366f128', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: f.status === 'error' ? 'not-allowed' : 'pointer', opacity: f.status === 'error' ? 0.4 : 1 }} title="Preview">
                        <Eye size={11} color="#6366f1" />
                      </button>
                      <button onClick={() => setDelTarget({ id: f.id, name: f.file_name })} style={{ width: 26, height: 26, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Trash2 size={11} color={t.negText} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL HAPUS */}
      {delTarget && (
        <div onClick={e => e.target === e.currentTarget && setDelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={18} color={t.negText} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus Riwayat Upload</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
                  Yakin menghapus riwayat <strong>"{delTarget.name}"</strong>? <br />
                  <span style={{ color: t.negText, marginTop: 4, display: 'block' }}>Semua baris stock level dari upload ini akan ikut terhapus permanen.</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDelTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>{deleting ? 'Menghapus…' : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}