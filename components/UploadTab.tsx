'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiFetch, apiJson } from '@/lib/apiFetch';

interface FileRow { id: string; original_name: string; file_size: number; record_count: number; status: 'completed'|'processing'|'error'; area: string; created_at: string; error_message?: string; }
interface Props { theme: Theme; }

export default function UploadTab({ theme }: Props) {
  const t = tk[theme];
  const [file, setFile] = useState<File | null>(null);
  const [area, setArea] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok'|'err'; text: string } | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [delTarget, setDelTarget] = useState<FileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    const r = await apiJson('/api/files');
    if (r.success) setFiles(r.data);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleFile = (f: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setMsg({ type:'err', text:'Format tidak didukung (.xlsx, .xls, .csv)' }); return; }
    setFile(f); setMsg(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    if (area.trim()) fd.append('area', area.trim());
    try {
      const r = await apiJson('/api/upload', { method:'POST', body:fd });
      if (r.success) {
        setMsg({ type:'ok', text:`Berhasil import ${r.data?.record_count?.toLocaleString('id-ID') ?? 0} records` });
        setFile(null); setArea('');
        if (inputRef.current) inputRef.current.value = '';
        await loadFiles();
      } else {
        setMsg({ type:'err', text: r.error || 'Upload gagal' });
      }
    } catch (e: any) {
      setMsg({ type:'err', text: e.message || 'Koneksi gagal' });
    } finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    await apiFetch(`/api/files?id=${delTarget.id}`, { method:'DELETE' });
    setDeleting(false); setDelTarget(null);
    await loadFiles();
  };

  const inp: React.CSSProperties = { width:'100%', padding:'9px 12px', fontSize:12, borderRadius:8, background:t.inputBg, border:`1px solid ${t.borderInput}`, color:t.text, outline:'none', fontFamily:FONT_MONO };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, width:'100%', padding:16 }}>
      <div style={{ background:t.cardbg, border:`1px solid ${t.borderCard}`, borderRadius:14, overflow:'hidden', boxShadow:t.shadowCard }}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:7, background:'#6366f115', border:'1px solid #6366f128', display:'flex', alignItems:'center', justifyContent:'center' }}><Upload size={12} color="#6366f1"/></div>
          <div style={{ fontSize:12, fontWeight:700, color:t.text }}>Upload File Baru</div>
        </div>
        <div style={{ padding:16 }}>
          {msg && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, marginBottom:14, background:msg.type==='ok'?t.posBg:t.negBg, border:`1px solid ${msg.type==='ok'?t.posBorder:t.negBorder}`, color:msg.type==='ok'?t.posText:t.negText, fontSize:12, fontFamily:FONT_MONO }}>
              {msg.type==='ok'?<CheckCircle size={13}/>:<AlertCircle size={13}/>}
              {msg.text}
              <button onClick={()=>setMsg(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', padding:0 }}><X size={11}/></button>
            </div>
          )}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
            onClick={()=>!file&&inputRef.current?.click()}
            style={{ border:`2px dashed ${dragging?'#6366f1':file?t.posBorder:t.borderInput}`, borderRadius:10, padding:file?14:28, textAlign:'center', background:dragging?'rgba(99,102,241,0.06)':file?t.posBg:t.inputBg, cursor:file?'default':'pointer', transition:'all 0.15s', marginBottom:14 }}
          >
            {!file?(
              <>
                <div style={{ width:40, height:40, borderRadius:10, background:t.inputBg, border:`1.5px dashed ${t.borderInput}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}><Upload size={18} color={dragging?'#6366f1':t.textMuted}/></div>
                <div style={{ fontSize:12, fontWeight:600, color:t.text, marginBottom:3 }}>{dragging?'Lepaskan di sini':'Drag & drop atau klik'}</div>
                <div style={{ fontSize:10, color:t.textMuted }}>.xlsx · .xls · .csv</div>
              </>
            ):(
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:t.posBg, border:`1px solid ${t.posBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FileSpreadsheet size={16} color={t.posText}/></div>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize:10, color:t.textMuted, fontFamily:FONT_MONO }}>{(file.size/1024/1024).toFixed(2)} MB</div>
                </div>
                <button onClick={e=>{e.stopPropagation();setFile(null);}} style={{ width:24, height:24, borderRadius:6, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}><X size={11} color={t.negText}/></button>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);}}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'end' }}>
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:600, color:t.textMuted, marginBottom:5, fontFamily:FONT_MONO, textTransform:'uppercase', letterSpacing:'0.08em' }}>Area / Label (opsional)</label>
              <input style={inp} type="text" placeholder="Contoh: Jawa Timur, Area 1…" value={area} onChange={e=>setArea(e.target.value)}/>
            </div>
            <button onClick={handleUpload} disabled={!file||uploading} style={{ height:37, padding:'0 20px', borderRadius:8, fontSize:12, fontWeight:700, border:'none', background:file&&!uploading?'#6366f1':t.inputBg, color:file&&!uploading?'#fff':t.textMuted, cursor:file&&!uploading?'pointer':'not-allowed', fontFamily:FONT_MONO, display:'flex', alignItems:'center', gap:6 }}>
              {uploading?(<><svg style={{ animation:'spin 0.8s linear infinite', width:12, height:12 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none"/></svg>Mengupload…</>):<><Upload size={12}/>Upload</>}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background:t.cardbg, border:`1px solid ${t.borderCard}`, borderRadius:14, overflow:'hidden', boxShadow:t.shadowCard }}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:7, background:'#10b98115', border:'1px solid #10b98128', display:'flex', alignItems:'center', justifyContent:'center' }}><FileSpreadsheet size={12} color="#10b981"/></div>
          <div style={{ fontSize:12, fontWeight:700, color:t.text }}>File Terupload</div>
          <div style={{ fontSize:10, color:t.textMuted, fontFamily:FONT_MONO, marginLeft:4 }}>{files.length} file</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ minWidth:560, width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['Nama File','Area','Records','Status','Tanggal','Aksi'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:h==='Aksi'?'center':'left', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:t.textMuted, borderBottom:`1px solid ${t.border}`, fontFamily:FONT_MONO, background:t.tableHead }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {files.map((f,i)=>(
                <tr key={f.id} style={{ background:i%2===1?t.tableAlt:'transparent' }}>
                  <td style={{ padding:'9px 12px', color:t.text, fontFamily:FONT_MONO, fontSize:11 }}>{f.original_name}</td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:11 }}>{f.area||'—'}</td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:11 }}>{f.record_count.toLocaleString('id-ID')}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:8, fontSize:9, fontWeight:600, fontFamily:FONT_MONO, background:f.status==='completed'?t.posBg:f.status==='error'?t.negBg:t.warnBg, color:f.status==='completed'?t.posText:f.status==='error'?t.negText:t.warnText, border:`1px solid ${f.status==='completed'?t.posBorder:f.status==='error'?t.negBorder:t.warnBorder}` }}>
                      {f.status==='completed'?'✓ Selesai':f.status==='error'?'✗ Error':'⟳ Proses'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:10, whiteSpace:'nowrap' }}>{new Date(f.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'2-digit'})}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center' }}>
                    <button onClick={()=>setDelTarget(f)} style={{ width:26, height:26, borderRadius:6, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Trash2 size={11} color={t.negText}/></button>
                  </td>
                </tr>
              ))}
              {files.length===0&&<tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:t.textMuted, fontSize:12, fontFamily:FONT_MONO }}>Belum ada file diupload</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {delTarget&&(
        <div onClick={e=>e.target===e.currentTarget&&setDelTarget(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:t.cardbg, border:`1px solid ${t.borderCard}`, borderRadius:14, padding:24, maxWidth:400, width:'100%' }}>
            <div style={{ display:'flex', gap:12, marginBottom:20 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Trash2 size={18} color={t.negText}/></div>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:5 }}>Hapus File</div>
                <div style={{ fontSize:12, color:t.textSub, lineHeight:1.6 }}>Yakin menghapus <strong>"{delTarget.original_name}"</strong>? Data transaksi terkait akan hilang permanen.</div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setDelTarget(null)} style={{ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:600, background:t.inputBg, color:t.textSub, border:`1px solid ${t.borderInput}`, cursor:'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, background:'#dc2626', color:'#fff', border:'none', cursor:deleting?'not-allowed':'pointer' }}>{deleting?'Menghapus…':'Hapus'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}