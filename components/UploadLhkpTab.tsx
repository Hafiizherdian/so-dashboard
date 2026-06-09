'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Trash2, ClipboardCheck } from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }
interface UploadRow { id: string; file_name: string; record_count: number; tgl_awal: string; tgl_akhir: string; created_at: string; }

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export default function UploadLhkpTab({ theme }: Props) {
  const t = tk[theme];
  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [uploads,   setUploads]   = useState<UploadRow[]>([]);
  const [delTarget, setDelTarget] = useState<UploadRow | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadUploads = async () => {
    const r = await apiJson('/api/lhkp?list=1');
    if (r.success) setUploads(r.data ?? []);
  };

  useEffect(() => { loadUploads(); }, []);

  const handleFile = (f: File) => {
    if (!/\.(xlsx|xls)$/i.test(f.name)) { setMsg({ type: 'err', text: 'Hanya file .xlsx atau .xls' }); return; }
    setFile(f); setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await apiJson('/api/lhkp/uploads', { method: 'POST', body: fd });
      if (r.success) {
        setMsg({ type: 'ok', text: `Berhasil import ${r.data.record_count.toLocaleString('id-ID')} records (${fmtDate(r.data.tgl_awal)} – ${fmtDate(r.data.tgl_akhir)})` });
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        await loadUploads();
      } else setMsg({ type: 'err', text: r.error || 'Upload gagal' });
    } catch { setMsg({ type: 'err', text: 'Koneksi gagal' }); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    const r = await apiJson(`/api/lhkp?id=${delTarget.id}`, { method: 'DELETE' });
    if (r.success) { setDelTarget(null); await loadUploads(); }
    setDeleting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: '100%' }}>

      {/* Format hint */}
      <div style={{ padding: '10px 14px', borderRadius: 10, background: t.infoBg, border: `1px solid ${t.infoBorder}`, fontSize: 10, color: t.infoText, fontFamily: FONT_MONO, lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Format kolom Excel LHKP yang diharapkan:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px' }}>
          {['Week','Tanggal','Mesin','Proses','No_Job_Order','No_Proses','No_LHKP','Output_Produk','Qty_Plan','Qty_Baik','Qty_Rusak','Unit'].map(col => (
            <span key={col} style={{ padding: '1px 6px', borderRadius: 4, background: t.inputBg, border: `1px solid ${t.infoBorder}`, fontSize: 9 }}>{col}</span>
          ))}
        </div>
      </div>

      {/* Upload card */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={12} color="#818cf8"/>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload File LHKP Baru</div>
        </div>
        <div style={{ padding: 16 }}>
          {msg && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.type === 'ok' ? t.posBg : t.negBg, border: `1px solid ${msg.type === 'ok' ? t.posBorder : t.negBorder}`, color: msg.type === 'ok' ? t.posText : t.negText, fontSize: 11, fontFamily: FONT_MONO }}>
              {msg.type === 'ok' ? <CheckCircle size={13} style={{ flexShrink: 0, marginTop: 1 }}/> : <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }}/>}
              <span style={{ flex: 1 }}>{msg.text}</span>
              <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={11}/></button>
            </div>
          )}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => !file && inputRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? '#6366f1' : file ? t.posBorder : t.borderInput}`, borderRadius: 10, padding: file ? 14 : 28, textAlign: 'center', background: dragging ? 'rgba(99,102,241,0.06)' : file ? t.posBg : t.inputBg, cursor: file ? 'default' : 'pointer', transition: 'all 0.15s', marginBottom: 14 }}
          >
            {!file ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: t.inputBg, border: `1.5px dashed ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Upload size={18} color={dragging ? '#6366f1' : t.textMuted}/>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 3 }}>{dragging ? 'Lepaskan di sini' : 'Drag & drop atau klik'}</div>
                <div style={{ fontSize: 10, color: t.textMuted }}>.xlsx · .xls</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: t.posBg, border: `1px solid ${t.posBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileSpreadsheet size={16} color={t.posText}/>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{(file.size/1024).toFixed(1)} KB</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ width: 26, height: 26, borderRadius: 7, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={11} color={t.negText}/>
                </button>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}/>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleUpload} disabled={!file || uploading} style={{ height: 37, padding: '0 22px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: file && !uploading ? '#6366f1' : t.inputBg, color: file && !uploading ? '#fff' : t.textMuted, cursor: file && !uploading ? 'pointer' : 'not-allowed', fontFamily: FONT_MONO, display: 'flex', alignItems: 'center', gap: 6, boxShadow: file && !uploading ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}>
              {uploading ? (<><svg style={{ animation:'spin 0.8s linear infinite',width:12,height:12 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>Mengupload…</>) : <><Upload size={12}/>Upload LHKP</>}
            </button>
          </div>
        </div>
      </div>

      {/* File list */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: '#10b98115', border: '1px solid #10b98128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={12} color="#10b981"/>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>File LHKP Terupload</div>
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginLeft: 4 }}>{uploads.length} file</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 620, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Nama File','Periode','Records','Tanggal Upload','Aksi'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign: h === 'Aksi' ? 'center' : h === 'Records' ? 'right' : 'left', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:t.textMuted, borderBottom:`1px solid ${t.border}`, fontFamily:FONT_MONO, background:t.tableHead }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploads.map((u, i) => (
                <tr key={u.id} style={{ background: i%2===1 ? t.tableAlt : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = i%2===1 ? t.tableAlt : 'transparent')}
                >
                  <td style={{ padding:'9px 12px', color:t.text, fontFamily:FONT_MONO, fontSize:11, maxWidth:250, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.file_name}</td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:11, whiteSpace:'nowrap' }}>{fmtDate(u.tgl_awal)} – {fmtDate(u.tgl_akhir)}</td>
                  <td style={{ padding:'9px 12px', color:t.text, fontFamily:FONT_MONO, fontSize:11, textAlign:'right', fontWeight:600 }}>{u.record_count.toLocaleString('id-ID')}</td>
                  <td style={{ padding:'9px 12px', color:t.textMuted, fontFamily:FONT_MONO, fontSize:10, whiteSpace:'nowrap' }}>{new Date(u.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center' }}>
                    <button onClick={() => setDelTarget(u)} style={{ width:26, height:26, borderRadius:6, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      <Trash2 size={11} color={t.negText}/>
                    </button>
                  </td>
                </tr>
              ))}
              {uploads.length === 0 && (
                <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:t.textMuted, fontSize:12, fontFamily:FONT_MONO }}>Belum ada file LHKP diupload</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm */}
      {delTarget && (
        <div onClick={e => e.target===e.currentTarget&&setDelTarget(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:t.cardbg, border:`1px solid ${t.borderCard}`, borderRadius:14, padding:24, maxWidth:420, width:'100%', boxShadow:'0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Trash2 size={18} color={t.negText}/>
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:5 }}>Hapus File LHKP</div>
                <div style={{ fontSize:12, color:t.textSub, lineHeight:1.6 }}>
                  Yakin menghapus <strong>"{delTarget.file_name}"</strong>?<br/>
                  Periode: {fmtDate(delTarget.tgl_awal)} – {fmtDate(delTarget.tgl_akhir)}<br/>
                  <span style={{ color:t.negText }}>{delTarget.record_count.toLocaleString('id-ID')} records akan terhapus permanen.</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setDelTarget(null)} style={{ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, background:t.inputBg, color:t.textSub, border:`1px solid ${t.borderInput}`, cursor:'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, background:'#dc2626', color:'#fff', border:'none', cursor:deleting?'not-allowed':'pointer' }}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}