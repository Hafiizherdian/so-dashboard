'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, X, CheckCircle,
  AlertCircle, Trash2, ClipboardCheck,
} from 'lucide-react';
import { Theme, tk, FONT_MONO, cardStyle, Tokens, cardHeaderStyle, iconBoxStyle, btnPrimaryStyle, btnDangerStyle, btnGhostStyle, } from '@/lib/theme';
// import {
//   cardStyle, cardHeaderStyle, iconBoxStyle, btnPrimaryStyle, btnDangerStyle, btnGhostStyle,
// } from '@/lib/theme.additions';
import { apiJson } from '@/lib/apiFetch';

// ─── Types ────────────────────────────────────────────────────
interface Props { theme: Theme; }

type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface UploadRow {
  id:           string;
  file_name:    string;
  record_count: number;
  tgl_awal:     string;
  tgl_akhir:    string;
  created_at:   string;
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  const mon = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${String(d.getDate()).padStart(2,'0')}-${mon[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

const ACCEPTED_EXTS = /\.xlsx?$/i;

const FORMAT_COLS = [
  'Week', 'Tanggal', 'Mesin', 'Proses',
  'No_Job_Order', 'No_Proses', 'No_LHKP',
  'Output_Produk', 'Qty_Plan', 'Qty_Baik', 'Qty_Rusak', 'Unit',
];

// ─── Sub-components ───────────────────────────────────────────

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
            fontSize: 10, color: t.textSub
          }}>
            {col}
          </span>
        ))}
      </div>
    </div>
  );
}

function AlertBar({ msg, onClose }: { msg: NonNullable<MsgState>; onClose: () => void }) {
  const isOk = msg.type === 'ok';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 8,
      background: isOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${isOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      color: isOk ? '#4ade80' : '#f87171',
      fontSize: 12, fontFamily: FONT_MONO,
    }}>
      {isOk ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

function DropZone({
  file, dragging, onDrop, onDragOver, onDragLeave, onClick, onRemove, t,
}: {
  file: File | null;
  dragging: boolean;
  onDrop: React.DragEventHandler;
  onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onClick: () => void;
  onRemove: () => void;
  t: Tokens;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !file && onClick()}
      style={{
        border: `2px dashed ${dragging ? '#6366f1' : file ? t.posBorder : t.borderInput}`,
        borderRadius: 10,
        padding: file ? 14 : 32,
        textAlign: 'center',
        background: dragging ? 'rgba(99,102,241,0.06)' : file ? t.posBg : t.inputBg,
        cursor: file ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {!file ? (
        <>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: t.inputBg, border: `1.5px dashed ${t.borderInput}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
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
            width: 38, height: 38, borderRadius: 9,
            background: t.posBg, border: `1px solid ${t.posBorder}`,
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
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: t.negBg, border: `1px solid ${t.negBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={11} color={t.negText} />
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirm({
  target, onConfirm, onCancel, deleting, t,
}: {
  target: UploadRow;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
  t: Tokens;
}) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ ...cardStyle(t), maxWidth: 400, width: '100%', padding: 22, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: t.negBg, border: `1px solid ${t.negBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trash2 size={16} color={t.negText} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 5 }}>
              Hapus Upload LHKP
            </div>
            <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.6 }}>
              Yakin hapus <strong>{target.file_name}</strong>?<br />
              <span style={{ color: t.negText }}>
                {target.record_count.toLocaleString('id-ID')} records akan terhapus permanen.
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={btnGhostStyle(t)}>Batal</button>
          <button onClick={onConfirm} disabled={deleting} style={btnDangerStyle(deleting)}>
            {deleting ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadHistory({
  uploads, onDelete, t,
}: {
  uploads: UploadRow[];
  onDelete: (row: UploadRow) => void;
  t: Tokens;
}) {
  if (uploads.length === 0) return null;

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
        <div style={iconBoxStyle('#818cf8')}>
          <ClipboardCheck size={12} color="#818cf8" />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
          Riwayat Upload LHKP
        </div>
        <span style={{ marginLeft: 4, fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>
          {uploads.length} file
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 560, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Nama File', 'Periode', 'Records', 'Uploaded', 'Aksi'].map(h => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uploads.map((row, i) => (
              <tr
                key={row.id}
                style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
              >
                <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.file_name}
                </td>
                <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {fmtDate(row.tgl_awal)} – {fmtDate(row.tgl_akhir)}
                </td>
                <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                  {row.record_count.toLocaleString('id-ID')}
                </td>
                <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                  {new Date(row.created_at).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <button
                    onClick={() => onDelete(row)}
                    style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: t.negBg, border: `1px solid ${t.negBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Hapus upload ini"
                  >
                    <Trash2 size={11} color={t.negText} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function UploadLhkpTab({ theme }: Props) {
  const t = tk[theme];

  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState<MsgState>(null);
  const [uploads,   setUploads]   = useState<UploadRow[]>([]);
  const [delTarget, setDelTarget] = useState<UploadRow | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load riwayat upload saat mount
  useEffect(() => {
    apiJson('/api/lhkp?list=1')
      .then(r => { if (r.success) setUploads(r.data ?? []); })
      .catch(err => console.error('[UploadLhkpTab] load uploads:', err));
  }, []);

  // ── Handlers ──
  function handleFile(f: File) {
    if (!ACCEPTED_EXTS.test(f.name)) {
      setMsg({ type: 'err', text: 'File harus berformat .xls atau .xlsx' });
      return;
    }
    setFile(f);
    setMsg(null);
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setMsg(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const r = await apiJson('/api/lhkp/uploads', { method: 'POST', body: fd });

      if (r.success) {
        const { record_count, tgl_awal, tgl_akhir, upload_id } = r.data;
        setMsg({
          type: 'ok',
          text: `Berhasil import ${record_count.toLocaleString('id-ID')} records (${fmtDate(tgl_awal)} – ${fmtDate(tgl_akhir)})`,
        });
        // Tambah ke list tanpa reload
        setUploads(prev => [{
          id:           upload_id,
          file_name:    file.name,
          record_count,
          tgl_awal,
          tgl_akhir,
          created_at:   new Date().toISOString(),
        }, ...prev]);
        setFile(null);
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Upload gagal, coba lagi' });
      }
    } catch (err) {
      console.error('[UploadLhkpTab] upload error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal, periksa jaringan' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!delTarget) return;

    setDeleting(true);
    try {
      const r = await apiJson(`/api/lhkp?id=${delTarget.id}`, { method: 'DELETE' });

      if (r.success) {
        setUploads(prev => prev.filter(u => u.id !== delTarget.id));
        setDelTarget(null);
        setMsg({ type: 'ok', text: 'Upload berhasil dihapus' });
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Gagal menghapus' });
      }
    } catch (err) {
      console.error('[UploadLhkpTab] delete error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal saat menghapus' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16,  }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <FormatGuide t={t} />

      <div style={cardStyle(t)}>
        <div style={cardHeaderStyle(t)}>
          {/* <div style={iconBoxStyle('#818cf8')}>
            <ClipboardCheck size={12} color="#818cf8" />
          </div> */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
              Upload File LHKP
            </div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
              Data akan ditambahkan ke tabel LHKP
            </div>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msg && <AlertBar msg={msg} onClose={() => setMsg(null)} />}

          <DropZone
            file={file}
            dragging={dragging}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            onRemove={() => setFile(null)}
            t={t}
          />

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={btnPrimaryStyle(!file || uploading)}
            >
              {uploading ? (
                <>
                  <svg
                    style={{ animation: 'spin 0.8s linear infinite', width: 13, height: 13 }}
                    viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Mengupload…
                </>
              ) : (
                <><Upload size={13} /> Upload LHKP</>
              )}
            </button>
          </div>
        </div>
      </div>

      <UploadHistory uploads={uploads} onDelete={setDelTarget} t={t} />

      {delTarget && (
        <DeleteConfirm
          target={delTarget}
          onConfirm={handleDelete}
          onCancel={() => setDelTarget(null)}
          deleting={deleting}
          t={t}
        />
      )}
    </div>
  );
}