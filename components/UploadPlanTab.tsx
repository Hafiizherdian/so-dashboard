'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Upload, FileSpreadsheet, X, CheckCircle, AlertCircle,
  Trash2, Eye, ClipboardList
} from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens } from '@/lib/theme';
import { apiFetch, apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }

interface UploadRow {
  id: string;
  nama_mesin: string;
  minggu_awal: string;
  minggu_akhir: string;
  file_name: string;
  created_at: string;
  total_jobs: number;
  status?: 'completed' | 'processing' | 'error';
}

const ACCEPTED_EXTS = /\.xlsx?$/i;

const FORMAT_INFO = [
  { label: 'Nama Mesin', desc: 'Dari cell header file Excel' },
  { label: 'Minggu Awal / Akhir', desc: 'Range minggu produksi' },
  { label: 'No Urut', desc: 'Nomor urut JOP' },
  { label: 'Nomor JOP', desc: 'Kode job order produksi' },
  { label: 'Nama Produk', desc: 'Deskripsi produk' },
  { label: 'Ukuran Kertas', desc: 'Format kertas yang dipakai' },
  { label: 'UP', desc: 'Unit per lembar' },
  { label: 'Qty JOP / Qty Cetak', desc: 'Target dan realisasi cetak' },
  { label: 'Shift 1 / 2 / 3', desc: 'Qty per shift per tanggal' },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.substring(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${String(d.getDate()).padStart(2, '0')}-${mon[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 10,
      padding: '11px 14px', fontSize: 11, color: t.text,
      fontFamily: FONT_MONO, lineHeight: 1.8,
    }}>
      <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#818cf8' }}>
          Format kolom Excel Plan Produksi:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
          {FORMAT_INFO.map((col) => (
            <span
              key={col.label}
              style={{
                padding: '2px 8px', borderRadius: 5, background: t.cardbg,
                border: `1px solid ${t.borderInput}`, fontSize: 10, color: t.textSub,
              }}
              title={col.desc}
            >
              {col.label}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: t.textMuted }}>
          *Arahkan kursor ke label untuk melihat deskripsi
        </div>
      </div>
    </div>
  );
}

// Komponen Preview Panel (Data Table)
const PreviewPanel = React.memo(function PreviewPanel({ fileId, fileName, t }: { fileId: string; fileName: string; t: Tokens; }) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allCols, setAllCols] = useState<string[]>([]);
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true); setError(''); setData([]); setAllCols([]); setActiveCols(new Set());
    apiJson(`/api/plan/${fileId}/preview`) // Pastikan endpoint ini tersedia di backend
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

// Modal Flat Design untuk Preview
function PreviewModal({ file, onClose, t }: { file: UploadRow; onClose: () => void; t: Tokens }) {
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
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview Data</div>
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

// Komponen Utama
export default function UploadPlanTab({ theme }: Props) {
  const t = tk[theme];
  
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [delTarget, setDelTarget] = useState<UploadRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadRow | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Layout mobile swap
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load Riwayat
  const fetchHistory = useCallback(() => {
    apiJson('/api/plan?list=1')
      .then(r => { if (r.success) setUploads(r.data ?? []); })
      .catch(err => console.error('[UploadPlanTab] load uploads:', err));
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleFile = (f: File) => {
    if (!ACCEPTED_EXTS.test(f.name)) {
      setMsg({ type: 'err', text: 'File harus berformat .xls atau .xlsx' });
      return;
    }
    setFile(f);
    setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);

    try {
      const r = await apiJson('/api/plan/upload', { method: 'POST', body: fd });
      if (r.success) {
        const { nama_mesin, minggu_awal, minggu_akhir, total_jobs, upload_id } = r.data;
        setMsg({
          type: 'ok',
          text: `Berhasil import ${total_jobs} JOP untuk ${nama_mesin} (${fmtDate(minggu_awal)} – ${fmtDate(minggu_akhir)})`,
        });
        setUploads(prev => [{
          id: upload_id, nama_mesin, minggu_awal, minggu_akhir,
          file_name: file.name, created_at: new Date().toISOString(), total_jobs,
        }, ...prev]);
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Upload gagal, coba lagi' });
      }
    } catch (err) {
      console.error('[UploadPlanTab] upload error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal, periksa jaringan' });
    } finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const r = await apiJson(`/api/plan?id=${delTarget.id}`, { method: 'DELETE' });
      if (r.success) {
        setUploads(prev => prev.filter(u => u.id !== delTarget.id));
        setDelTarget(null);
        setMsg({ type: 'ok', text: 'Upload berhasil dihapus' });
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Gagal menghapus' });
      }
    } catch (err) {
      console.error('[UploadPlanTab] delete error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal saat menghapus' });
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} t={t} />}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'stretch', width: '100%' }}>
        {/* Upload Panel (Kiri di Desktop, Bawah di Mobile) */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 2 : 1, background: t.cardbg, border: `1px solid ${t.borderCard}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: '#6366f115', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={12} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload Plan Produksi</div>
              <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Data JOP dan shift akan diparse otomatis</div>
            </div>
          </div>
          
          <div style={{ padding: 16 }}>
            {msg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.type === 'ok' ? t.posBg : t.negBg, border: `1px solid ${msg.type === 'ok' ? t.posBorder : t.negBorder}`, color: msg.type === 'ok' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO }}>
                {msg.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {msg.text}
                <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={11} /></button>
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => !file && inputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#6366f1' : file ? t.posBorder : t.borderInput}`, borderRadius: 10, padding: file ? 14 : 28, textAlign: 'center', background: dragging ? 'rgba(99,102,241,0.06)' : file ? t.posBg : t.inputBg, cursor: file ? 'default' : 'pointer', transition: 'all 0.15s', marginBottom: 14 }}
            >
              {!file ? (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: t.inputBg, border: `1.5px dashed ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Upload size={18} color={dragging ? '#6366f1' : t.textMuted} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{dragging ? 'Lepaskan di sini' : 'Drag & drop atau klik'}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>Mendukung .xlsx · .xls</div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: t.posBg, border: `1px solid ${t.posBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileSpreadsheet size={16} color={t.posText} />
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
            
            <button onClick={handleUpload} disabled={!file || uploading} style={{ width: '100%', height: 37, padding: '0 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: file && !uploading ? '#6366f1' : t.inputBg, color: file && !uploading ? '#fff' : t.textMuted, cursor: file && !uploading ? 'pointer' : 'not-allowed', fontFamily: FONT_MONO, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {uploading ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite', width: 12, height: 12 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                  Mengupload…
                </>
              ) : (
                <><Upload size={12} /> Upload Plan Produksi</>
              )}
            </button>
          </div>
        </div>

        {/* Format Guide (Kanan di Desktop, Atas di Mobile) */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 1 : 2, overflow: 'hidden', display: 'flex' }}>
          <FormatGuide t={t} />
        </div>
      </div>

      {/* Tabel Riwayat */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#6366f115', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={12} color="#6366f1" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Riwayat Upload</div>
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginLeft: 4 }}>{uploads.length} upload</div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 700, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Mesin', 'Periode', 'JOP', 'File', 'Status', 'Tanggal', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Aksi' ? 'center' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploads.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                  <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600 }}>{row.nama_mesin}</td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(row.minggu_awal)} – {fmtDate(row.minggu_akhir)}</td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.total_jobs}</td>
                  <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.file_name}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: (row.status !== 'error') ? t.posBg : t.negBg, color: (row.status !== 'error') ? t.posText : t.negText, border: `1px solid ${(row.status !== 'error') ? t.posBorder : t.negBorder}` }}>
                      {(row.status !== 'error') ? '✓ Selesai' : '✗ Error'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
                      <button onClick={() => setPreviewFile(row)} disabled={row.status === 'error'} style={{ width: 26, height: 26, borderRadius: 6, background: '#6366f115', border: '1px solid #6366f128', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: row.status === 'error' ? 'not-allowed' : 'pointer', opacity: row.status === 'error' ? 0.4 : 1 }} title="Preview">
                        <Eye size={11} color="#6366f1" />
                      </button>
                      <button onClick={() => setDelTarget(row)} style={{ width: 26, height: 26, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Hapus">
                        <Trash2 size={11} color={t.negText} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {uploads.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>Belum ada riwayat upload</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Hapus Flat Design */}
      {delTarget && (
        <div onClick={e => e.target === e.currentTarget && setDelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={18} color={t.negText} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus Plan Produksi</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
                  Yakin hapus <strong>{delTarget.nama_mesin}</strong> periode {fmtDate(delTarget.minggu_awal)} – {fmtDate(delTarget.minggu_akhir)}?<br />
                  <span style={{ color: t.negText, marginTop: 4, display: 'block' }}>Semua {delTarget.total_jobs} JOP dan data shift terkait akan terhapus.</span>
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