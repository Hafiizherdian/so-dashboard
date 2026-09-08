'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, X, CheckCircle,
  AlertCircle, Trash2, Layers,
} from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens, cardStyle, cardHeaderStyle, iconBoxStyle,
  btnPrimaryStyle, btnDangerStyle, btnGhostStyle, } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

// Types
interface Props { theme: Theme; }

type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface UploadRow {
  id:         string;
  tanggal:    string;
  status_wip: string | null;
  keterangan: string | null;
  file_name:  string;
  created_at: string;
  row_count:  number;
}

// Helpers
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.substring(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const mon = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${String(d.getDate()).padStart(2,'0')}-${mon[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

// Warna badge status disesuaikan sama nilai umum di kolom "STATUS WIP" Excel
// (mis. "IN PROGRESS", "SELESAI") — fallback abu-abu kalau nilainya tidak dikenali atau kosong.
function statusColor(status: string | null): { bg: string; border: string; text: string } {
  const s = (status ?? '').toUpperCase();
  if (s.includes('PROGRESS')) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' };
  if (s.includes('SELESAI') || s.includes('DONE')) return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#4ade80' };
  if (s.includes('PENDING') || s.includes('TUNDA')) return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#f87171' };
  return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', text: '#94a3b8' };
}

const ACCEPTED_EXTS = /\.xlsx?$/i;

const FORMAT_INFO = [
  { label: 'Tanggal', desc: 'Dari baris tanggal di atas sheet "WIP"' },
  { label: 'Status WIP', desc: 'Contoh: IN PROGRESS' },
  { label: 'Deskripsi', desc: 'Nama produk / job' },
  { label: 'Nomor JOP', desc: 'Kode job order produksi' },
  { label: 'UP', desc: 'Unit per lembar' },
  { label: 'Cetak / Embos / Plong', desc: 'Realisasi proses per tahap (Lbr)' },
  { label: 'Pretel / Sortir', desc: 'Realisasi proses lanjutan (Pcs)' },
  { label: 'WIP Total', desc: 'Total barang dalam proses (Pcs)' },
  { label: 'Barang Jadi', desc: 'Qty yang sudah jadi (Pcs)' },
];

// Sub-components

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div style={{
      flex: 1,
      padding: '11px 14px', borderRadius: 10,
      background: t.inputBg, border: `1px solid ${t.border}`,
      fontSize: 11, color: t.text, fontFamily: FONT_MONO, lineHeight: 1.8,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#818cf8' }}>Format kolom Excel (sheet "WIP"):</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {FORMAT_INFO.map(col => (
          <span key={col.label} style={{
            padding: '1px 7px', borderRadius: 5,
            background: t.cardbg, border: `1px solid ${t.borderInput}`,
            fontSize: 10, color: t.textSub
          }}>
            {col.label}
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
      <div style={{ ...cardStyle(t), maxWidth: 420, width: '100%', padding: 22, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
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
              Hapus Data WIP
            </div>
            <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.6 }}>
              Yakin hapus data WIP tanggal <strong>{fmtDate(target.tanggal)}</strong>?<br />
              <span style={{ color: t.negText }}>
                Semua {target.row_count} job akan terhapus permanen.
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
        <div style={iconBoxStyle('#6366f1')}>
          <Layers size={12} color="#6366f1" />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
          Riwayat Upload WIP
        </div>
        <span style={{ marginLeft: 4, fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>
          {uploads.length} upload
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 600, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Tanggal', 'Status', 'Job', 'File', 'Diupload', 'Aksi'].map(h => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uploads.map((row, i) => {
              const sc = statusColor(row.status_wip);
              return (
                <tr
                  key={row.id}
                  style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                >
                  <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {fmtDate(row.tanggal)}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {row.status_wip ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: 5,
                        background: sc.bg, border: `1px solid ${sc.border}`,
                        color: sc.text, fontSize: 10, fontWeight: 600, fontFamily: FONT_MONO,
                        whiteSpace: 'nowrap',
                      }}>
                        {row.status_wip}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: t.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                    {row.row_count} job
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.file_name}
                  </td>
                  <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main Component
export default function UploadWipTab({ theme }: Props) {
  const t = tk[theme];

  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState<MsgState>(null);
  const [uploads,   setUploads]   = useState<UploadRow[]>([]);
  const [delTarget, setDelTarget] = useState<UploadRow | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load riwayat saat mount
  useEffect(() => {
    apiJson('/api/wip')
      .then(r => { if (r.success) setUploads(r.data?.history ?? []); })
      .catch(err => console.error('[UploadWipTab] load uploads:', err));
  }, []);

  // Handlers
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
      const r = await apiJson('/api/wip/upload', { method: 'POST', body: fd });

      if (r.success) {
        const { tanggal, status_wip, keterangan, row_count, upload_id } = r.data;
        setMsg({
          type: 'ok',
          text: `Berhasil import ${row_count} job WIP untuk tanggal ${fmtDate(tanggal)}${status_wip ? ` (${status_wip})` : ''}`,
        });
        setUploads(prev => [{
          id:         upload_id,
          tanggal,
          status_wip,
          keterangan,
          file_name:  file.name,
          created_at: new Date().toISOString(),
          row_count,
        }, ...prev]);
        setFile(null);
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Upload gagal, coba lagi' });
      }
    } catch (err) {
      console.error('[UploadWipTab] upload error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal, periksa jaringan' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!delTarget) return;

    setDeleting(true);
    try {
      const r = await apiJson(`/api/wip?id=${delTarget.id}`, { method: 'DELETE' });

      if (r.success) {
        setUploads(prev => prev.filter(u => u.id !== delTarget.id));
        setDelTarget(null);
        setMsg({ type: 'ok', text: 'Upload berhasil dihapus' });
      } else {
        setMsg({ type: 'err', text: r.error ?? 'Gagal menghapus' });
      }
    } catch (err) {
      console.error('[UploadWipTab] delete error:', err);
      setMsg({ type: 'err', text: 'Koneksi gagal saat menghapus' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16,  }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

               <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1, ...cardStyle(t) }}>
          <div style={cardHeaderStyle(t)}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                Upload File WIP
              </div>
              <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
                Data job, tanggal, dan status akan diparse otomatis dari sheet "WIP"
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
                  <><Upload size={13} /> Upload Data WIP</>
                )}
              </button>
            </div>
          </div>
        </div>

        <FormatGuide t={t} />
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