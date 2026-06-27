'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, X, CheckCircle, AlertCircle,
  Calendar, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import {
  Theme, tk, FONT_MONO, Tokens,
  inputStyle, btnPrimaryStyle, cardStyle, cardHeaderStyle, iconBoxStyle,
} from '@/lib/theme';
import { apiFetch, apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }
type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface HistoryRow {
  id:           string;
  filename:     string;
  periode:      string;
  record_count: number;
  uploaded_by:  string;
  uploaded_at:  string;
}

const ACCEPTED_EXTS = /\.xlsx?$/i;
const FORMAT_COLS   = [
  'Produk', 'Jenis Kertas', 'Gramasi', 'Merk',
  'L (lebar)', 'P (panjang)', 'Unit',
  'Saldo Awal', 'Masuk', 'Keluar', 'Keterangan',
];
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div style={{
      padding: '11px 14px', borderRadius: 10,
      background: t.cardbg, border: `1px solid ${t.border}`,
      fontSize: 11, color: t.text, fontFamily: FONT_MONO, lineHeight: 1.8,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#818cf8' }}>Format kolom Excel:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {FORMAT_COLS.map(col => (
          <span key={col} style={{
            padding: '1px 7px', borderRadius: 5,
            background: t.inputBg, border: `1px solid ${t.borderInput}`,
            fontSize: 10, color: t.textSub,
          }}>{col}</span>
        ))}
      </div>
    </div>
  );
}

function AlertBar({ msg, onClose, t }: { msg: NonNullable<MsgState>; onClose: () => void; t: Tokens }) {
  const { type, text } = msg;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8,
      background: type === 'ok' ? '#0a2e1c' : '#2e0a0a',
      border: `1px solid ${type === 'ok' ? '#166534' : '#991b1b'}`,
      color: type === 'ok' ? '#4ade80' : '#f87171',
      fontSize: 12, fontFamily: FONT_MONO,
    }}>
      {type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      <span style={{ flex: 1 }}>{text}</span>
      <button onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
        <X size={11} />
      </button>
    </div>
  );
}

function DropZone({ file, dragging, onDrop, onDragOver, onDragLeave, onClick, onRemove, t }: {
  file: File | null; dragging: boolean;
  onDrop: React.DragEventHandler; onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler; onClick: () => void;
  onRemove: () => void; t: Tokens;
}) {
  return (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => !file && onClick()}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : file ? t.posBorder : t.borderInput}`,
        borderRadius: 10, padding: file ? 14 : 32, textAlign: 'center',
        background: dragging ? 'rgba(99,102,241,0.06)' : file ? t.posBg : t.inputBg,
        cursor: file ? 'default' : 'pointer', transition: 'all 0.15s',
      }}
    >
      {!file ? (
        <>
          <div style={{
            width: 44, height: 44, borderRadius: 11, background: t.inputBg,
            border: `1.5px dashed ${t.borderInput}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
          }}>
            <Upload size={20} color={dragging ? '#6366f1' : t.textMuted} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
            {dragging ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih file'}
          </div>
          <div style={{ fontSize: 10, color: t.textMuted }}>Mendukung .xlsx · .xls</div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: t.posBg,
            border: `1px solid ${t.posBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FileSpreadsheet size={18} color={t.posText} />
          </div>
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 2 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{
              width: 26, height: 26, borderRadius: 7, background: t.negBg,
              border: `1px solid ${t.negBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
            <X size={11} color={t.negText} />
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryTable({ history, loading, deleting, delTarget, onDelete, onConfirmDelete, onCancelDelete, t }: {
  history: HistoryRow[]; loading: boolean; deleting: boolean;
  delTarget: HistoryRow | null;
  onDelete: (row: HistoryRow) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  t: Tokens;
}) {
  const thS: React.CSSProperties = {
    padding: '8px 12px', textAlign: 'left',
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: t.textMuted,
    borderBottom: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, background: t.tableHead,
  };

  return (
    <div style={cardStyle(t)}>
      <div style={cardHeaderStyle(t)}>
        <div style={iconBoxStyle('#10b981')}><FileSpreadsheet size={12} color="#10b981" /></div>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Riwayat Upload</div>
        {!loading && (
          <span style={{ marginLeft: 4, fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>
            {history.length} file
          </span>
        )}
      </div>

      {delTarget && (
        <div onClick={e => e.target === e.currentTarget && onCancelDelete()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, padding: 24, maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={18} color={t.negText} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus File</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>Yakin menghapus <strong>"{delTarget.filename}"</strong>? Data transaksi terkait akan hilang permanen.</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onCancelDelete} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={onConfirmDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>{deleting ? 'Menghapus…' : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>
          Memuat riwayat…
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>
          Belum ada riwayat upload
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 520, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Nama File', 'Periode', 'Records', 'Oleh', 'Status', 'Waktu', ''].map((h, i) => (
                  <th key={i} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                  <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.filename}
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.periode}</td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                    {row.record_count.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10 }}>{row.uploaded_by}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                      fontFamily: FONT_MONO, background: t.posBg, color: t.posText,
                      border: `1px solid ${t.posBorder}`,
                    }}>✓ Selesai</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {new Date(row.uploaded_at).toLocaleString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <button onClick={() => onDelete(row)}
                      style={{
                        width: 24, height: 24, borderRadius: 6, background: t.negBg,
                        border: `1px solid ${t.negBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}>
                      <Trash2 size={11} color={t.negText} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function UploadKertasTab({ theme }: Props) {
  const t = tk[theme];

  const [file,        setFile]        = useState<File | null>(null);
  const [periode,     setPeriode]     = useState(new Date().toISOString().slice(0, 7));
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [delTarget,   setDelTarget]   = useState<HistoryRow | null>(null); // ← fix: bukan boolean
  const [deleting,    setDeleting]    = useState(false);
  const [msg,         setMsg]         = useState<MsgState>(null);
  const [history,     setHistory]     = useState<HistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentYear,  setCurrentYear]  = useState(new Date().getFullYear());

  const inputRef    = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [activeYear, activeMonthStr] = periode.split('-');
  const activeMonth = parseInt(activeMonthStr, 10) - 1;

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await apiJson('/api/kertas/upload?limit=30');
      if (r.success) setHistory(r.data);
    } catch (err) {
      console.error('[UploadKertasTab] fetch history error:', err);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleFile(f: File) {
    if (!ACCEPTED_EXTS.test(f.name)) {
      setMsg({ type: 'err', text: 'File harus berformat .xls atau .xlsx' });
      return;
    }
    setFile(f);
    setMsg(null);
  }

  function handleSelectMonth(monthIndex: number) {
    const monthStr = String(monthIndex + 1).padStart(2, '0');
    setPeriode(`${currentYear}-${monthStr}`);
    setShowCalendar(false);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setMsg(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('periode', periode);

    try {
      const r = await apiJson('/api/kertas/upload', { method: 'POST', body: fd });
      if (!r.success) { setMsg({ type: 'err', text: r.error ?? 'Upload gagal, coba lagi' }); return; }
      await fetchHistory();
      setMsg({ type: 'ok', text: `Berhasil import ${(r.count ?? 0).toLocaleString('id-ID')} records untuk periode ${periode}` });
      setFile(null);
    } catch (err) {
      console.error('[UploadKertasTab] upload error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal, periksa jaringan' });
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/kertas/delete?id=${delTarget.id}`, { method: 'DELETE' });
      setDelTarget(null);     // ← fix: null bukan false
      await fetchHistory();   // ← fix: bukan files()
    } catch (err) {
      console.error('[UploadKertasTab] delete error:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormatGuide t={t} />

      <div style={cardStyle(t)}>
        <div style={cardHeaderStyle(t)}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload File Stok Kertas</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
              Data akan ditambahkan ke tabel Stok Level
            </div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msg && <AlertBar msg={msg} onClose={() => setMsg(null)} t={t} />}

          <div style={{ position: 'relative' }} ref={calendarRef}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted,
              marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Periode *
            </label>
            <button type="button" onClick={() => setShowCalendar(!showCalendar)}
              style={{
                ...inputStyle(t, { width: 'auto' }), display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left', minWidth: 180, padding: '8px 12px',
              }}>
              <Calendar size={14} color={t.textMuted} />
              <span style={{ color: t.text, fontSize: 12, fontFamily: FONT_MONO }}>
                {NAMA_BULAN[activeMonth]} {activeYear}
              </span>
            </button>

            {showCalendar && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50,
                width: 260, background: t.cardbg, border: `1px solid ${t.border}`,
                borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)', padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button type="button" onClick={() => setCurrentYear(y => y - 1)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.text, display: 'flex', padding: 4 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{currentYear}</span>
                  <button type="button" onClick={() => setCurrentYear(y => y + 1)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.text, display: 'flex', padding: 4 }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {NAMA_BULAN.map((bulan, idx) => {
                    const isSelected = currentYear === parseInt(activeYear, 10) && idx === activeMonth;
                    return (
                      <button key={bulan} type="button" onClick={() => handleSelectMonth(idx)}
                        style={{
                          padding: '8px 4px', borderRadius: 6, fontSize: 11,
                          fontFamily: FONT_MONO, cursor: 'pointer', textAlign: 'center',
                          border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                          background: isSelected ? 'rgba(99,102,241,0.15)' : t.inputBg,
                          color: isSelected ? '#818cf8' : t.textSub, transition: 'all 0.1s',
                        }}>
                        {bulan.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DropZone
            file={file} dragging={dragging}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            onRemove={() => setFile(null)}
            t={t}
          />
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleUpload} disabled={!file || uploading} style={btnPrimaryStyle(!file || uploading)}>
              {uploading ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Mengupload…
                </>
              ) : (
                <><Upload size={13} /> Upload Stok Kertas</>
              )}
            </button>
          </div>
        </div>
      </div>

      <HistoryTable
        history={history} loading={histLoading}
        deleting={deleting} delTarget={delTarget}
        onDelete={row => setDelTarget(row)}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={() => setDelTarget(null)}
        t={t}
      />
    </div>
  );
}