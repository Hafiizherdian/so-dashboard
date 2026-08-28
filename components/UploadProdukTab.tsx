'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Trash2, Database, List, Package } from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

// --- Types ---
interface Props { theme: Theme; }
type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface UploadRow {
  id: string; file_name: string; total_rows: number; inserted_count: number; updated_count: number; uploaded_by: string; created_at: string;
}

interface MsmrUploadRow {
  id: number; file_name: string; status: string; sheet_count: number; total_rows: number; created_at: string;
}

const FORMAT_COLS_PRODUK = [
  'Nama Brand / Kode Brand', 'Kategori', 'Kode Pabrik / Pabrik',
  'Batang/Bks, Bks/Slop, dst', 'Jenis', 'Up, Kertas, GSM, L, P, KG/RIM', 'QTY PCS/LEMBAR/RIM/TON'
];

const ACCEPTED_EXTS = /\.(xlsx|xls)$/i;

// --- Sub Components ---

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div style={{ flex: 1, padding: '11px 14px', borderRadius: 10, fontSize: 11, color: t.text, fontFamily: FONT_MONO, lineHeight: 1.8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Atas: Produk */}
        <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={14} /> Format Kolom Master Produk:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
            {FORMAT_COLS_PRODUK.map((col) => (
              <span key={col} style={{ padding: '2px 8px', borderRadius: 6, background: t.cardbg, border: `1px solid ${t.borderInput}`, fontSize: 10, color: t.textSub }}>
                {col}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: t.textMuted }}>* Upload ulang otomatis mengupdate data (kode pabrik + kode brand + jenis).</div>
        </div>

        {/* Bawah: MSMR */}
        <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={14} /> Format File MSMR:
          </div>
          <div style={{ color: t.textSub, marginBottom: 4 }}>File .xls Monthly S&D Management Report.</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: t.textSub }}>
            <li>1 sheet per PT (CGC, KTP, Dll)</li>
            <li>Ditambah sheet REKAP</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- MAIN EXPORT COMPONENT ---
export default function UploadProdukTab({ theme }: Props) {
  const t = tk[theme];

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<MsgState>(null);

  const [uploadsProduk, setUploadsProduk] = useState<UploadRow[]>([]);
  const [uploadsMsmr, setUploadsMsmr] = useState<MsmrUploadRow[]>([]);

  const [delTarget, setDelTarget] = useState<{ id: string | number; name: string; type: 'produk'|'msmr' } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistories = async () => {
    apiJson('/api/produk/upload').then(r => { if (r.success) setUploadsProduk(r.data ?? []); });
    apiJson('/api/msmr/upload').then(r => { if (r.success) setUploadsMsmr(r.data ?? []); });
  };

  useEffect(() => { loadHistories(); }, []);

  // Menggabungkan kedua data histori dan mengurutkannya berdasarkan yang terbaru
  const mergedUploads = useMemo(() => {
    const produk = uploadsProduk.map(p => ({ ...p, _type: 'produk' as const }));
    const msmr = uploadsMsmr.map(m => ({ ...m, _type: 'msmr' as const }));
    const combined = [...produk, ...msmr];

    // Sort descending (terbaru di atas)
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [uploadsProduk, uploadsMsmr]);

  const handleFile = (f: File) => {
    if (!ACCEPTED_EXTS.test(f.name)) { setMsg({ type: 'err', text: 'Format tidak didukung (.xlsx, .xls)' }); return; }
    setFile(f); setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMsg(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const r = await apiJson('/api/upload', { method: 'POST', body: fd });

      if (r.success) {
        if (r.type === 'produk') {
          setMsg({ type: 'ok', text: `Berhasil import Produk: ${r.data.inserted} baru, ${r.data.updated} update` });
        } else if (r.type === 'msmr') {
          setMsg({ type: 'ok', text: `Berhasil import MSMR: ${r.data.total_sheets} sheet diproses` });
        } else {
          setMsg({ type: 'ok', text: `Berhasil import ${r.type.replace('_', ' ')}: ${r.count} baris diproses` });
        }

        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        await loadHistories();
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
    const endpoint = delTarget.type === 'produk' ? `/api/produk/uploads?id=${delTarget.id}` : `/api/msmr/uploads?id=${delTarget.id}`;

    await apiJson(endpoint, { method: 'DELETE' });
    setDeleting(false); setDelTarget(null);
    await loadHistories();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {/* --- BOX UPLOAD --- */}
        <div style={{ flex: 1, background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={12} color={t.text} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload File Baru</div>
          </div>

          <div style={{ padding: 16 }}>
            {msg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontSize: 12, fontFamily: FONT_MONO }}>
                {msg.type === 'ok' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {msg.text}
                <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={11} /></button>
              </div>
            )}

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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                style={{
                  height: 37,
                  padding: '0 20px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  background: file && !uploading ? '#6366f1' : t.inputBg,
                  color: file && !uploading ? '#fff' : t.textMuted,
                  cursor: file && !uploading ? 'pointer' : 'not-allowed',
                  fontFamily: FONT_MONO,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
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

        <FormatGuide t={t} />
      </div>

      {/* --- BOX HISTORI GABUNGAN --- */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <List size={12} color={t.text} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Riwayat Upload Data</div>
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginLeft: 'auto' }}>{mergedUploads.length} file</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 600, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['File', 'Jenis', 'Info Data', 'Tanggal', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Aksi' ? 'center' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mergedUploads.map((f, i) => (
                <tr key={`${f._type}-${f.id}`} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                  <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11 }}>{f.file_name}</td>

                  {/* Kolom Jenis (Produk atau MSMR) */}
                  <td style={{ padding: '9px 12px', fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600 }}>
                    {f._type === 'produk' ? (
                      <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}> Master Produk</span>
                    ) : (
                      <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}> MSMR</span>
                    )}
                  </td>

                  {/* Kolom Info Data (Format disesuaikan berdasarkan type) */}
                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                    {f._type === 'produk'
                      ? `${(f.total_rows ?? 0).toLocaleString('id-ID')} baris`
                      : `${(f as any).sheet_count} sheet, ${(f.total_rows ?? 0).toLocaleString('id-ID')} baris`
                    }
                  </td>

                  <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                    {new Date(f.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>

                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <button onClick={() => setDelTarget({ id: f.id, name: f.file_name, type: f._type })} style={{ width: 26, height: 26, borderRadius: 6, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Trash2 size={11} color={t.negText} />
                    </button>
                  </td>
                </tr>
              ))}
              {mergedUploads.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>Belum ada data upload</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL HAPUS --- */}
      {delTarget && (
        <div onClick={e => e.target === e.currentTarget && setDelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24, maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Trash2 size={18} color={t.negText} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus Riwayat Upload</div>
                <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.6 }}>
                  Yakin menghapus riwayat <strong>"{delTarget.name}"</strong>? <br />
                  {delTarget.type === 'msmr' ? <span style={{ color: t.negText }}>Semua data dari file ini akan ikut terhapus.</span> : 'Data produk yang sudah masuk tetap tersimpan.'}
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