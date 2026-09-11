'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Trash2, Eye } from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens } from '@/lib/theme';
import { apiFetch, apiJson } from '@/lib/apiFetch';

interface FileRow { id: string; original_name: string; file_size: number; record_count: number; status: 'completed'|'processing'|'error'; created_at: string; error_message?: string; }
interface Props { theme: Theme; }

const FORMAT_COLS_PENJ   = [
  'Week', 'Tanggal', 'Produk id', 'QTY_PO',
  'Tipe Customer', 'Pelanggan', 'nomor so',
  'Jenis', 'Kategori', 'Deskripsi Produk', 'Brand',
  'qty terkirim', 'satuan', 'harga', 'bruto', 'diskon',
  'pajak', 'sub total', 'salesman', 'kota', 'kecamatan'
];

const FORMAT_COLS_SO    = [
  'Week', 'Tanggal', 'Column14', 'ref po',
  'no so', 'Customer', 'Produk', 'Panjang',
  'lebar', 'tinggi', 'berat', 'harga',
  'uom', 'qty order', 'qty delivered', 'qty sisa'
]

function FormatGuide({ t }: { t: Tokens }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '11px 14px',
        fontSize: 11,
        color: t.text,
        fontFamily: FONT_MONO,
        lineHeight: 1.8,
      }}
    >
      {/* Penjualan */}
      <div style={{ padding: '5px 5px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: '#818cf8' }}>
          Format kolom Excel Penjualan:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          {FORMAT_COLS_PENJ.map((col) => (
            <span
              key={col}
              style={{
                padding: '1px 7px',
                borderRadius: 5,
                background: t.cardbg,
                border: `1px solid ${t.borderInput}`,
                fontSize: 10,
                color: t.textSub,
              }}
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* SO */}
      <div style={{ padding: '18px 5px', borderRadius: 10, border: `1px solid ${t.borderInput}`, background: t.inputBg }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: '#818cf8' }}>
          Format kolom Excel SO:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          {FORMAT_COLS_SO.map((col) => (
            <span
              key={col}
              style={{
                padding: '1px 7px',
                borderRadius: 5,
                background: t.cardbg,
                border: `1px solid ${t.borderInput}`,
                fontSize: 10,
                color: t.textSub,
              }}
            >
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// PreviewPanel
const PreviewPanel = React.memo(function PreviewPanel({ fileId, fileName, t }: {
  fileId: string; fileName: string; t: Tokens;
}) {
  const [data,       setData]       = useState<Record<string, unknown>[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [allCols,    setAllCols]    = useState<string[]>([]);
  const [activeCols, setActiveCols] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true); setError(''); setData([]); setAllCols([]); setActiveCols(new Set());
    apiJson(`/api/files/${fileId}/preview`)
      .then(r => {
        if (r.success && r.data?.length) {
          const cols = Object.keys(r.data[0]);
          setAllCols(cols);
          setActiveCols(new Set(cols));
          setData(r.data);
        } else { setError(r.error || 'Tidak ada data'); }
      })
      .catch(() => setError('Gagal memuat preview'))
      .finally(() => setLoading(false));
  }, [fileId]);

  const numericCols = useMemo(() => allCols.filter(c => data.every(row => {
    const v = row[c]; return v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  })), [data, allCols]);

  const isNumericCell = (col: string, val: unknown) =>
    numericCols.includes(col) && val !== '' && val !== null && !isNaN(Number(val));

  const isDateCell = (col: string, val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return false;
    return /tanggal|date|created_at|updated_at/i.test(col);
  };

  const fmtCell = (col: string, val: unknown): string => {
    if (val === null || val === undefined || val === '') return '—';
    if (isDateCell(col, val)) {
      return new Date(val as string).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    }
    if (isNumericCell(col, val)) {
      if (/harga|bruto|sub.?total|pajak|diskon/i.test(col)) return `Rp ${Number(val).toLocaleString('id-ID')}`;
      return Number(val).toLocaleString('id-ID');
    }
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

  if (loading) return (
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>
      Memuat preview…
    </div>
  );
  if (error) return (
    <div style={{ padding: '10px 13px', borderRadius: 8, background: t.negBg, border: `1px solid ${t.negBorder}`, color: t.negText, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
      <AlertCircle size={12} style={{ flexShrink: 0 }} />{error}
    </div>
  );
  if (!data.length) return (
    <div style={{ padding: 28, textAlign: 'center', color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>Tidak ada data.</div>
  );

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.cardbg }}>
      {/* Header */}
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

      {/* Column toggles */}
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

      {/* Table */}
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

      <div style={{ padding: '7px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.tableHead, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{visibleCols.length} / {allCols.length} kolom</span>
        <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>klik label kolom untuk toggle</span>
      </div>
    </div>
  );
});

// PreviewModal
function PreviewModal({ file, onClose, t }: { file: FileRow; onClose: () => void; t: Tokens }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, width: '100%', maxWidth: 1000, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.border}`, background: t.tableHead, flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#6366f115', border: '1px solid #6366f128', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={15} color="#6366f1" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Preview Data</div>
              <div style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>{file.original_name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={14} color={t.negText} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <PreviewPanel fileId={file.id} fileName={file.original_name} t={t} />
        </div>
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${t.border}`, background: t.tableHead, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

export default function UploadTab({ theme }: Props) {
  const t = tk[theme];
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok'|'err'; text: string } | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [delTarget, setDelTarget] = useState<FileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Layout mobile: Format Guide di atas, dropzone di bawahnya (ditukar lewat CSS order),
  // baris file terupload tetap section terpisah paling bawah.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
    try {
      const r = await apiJson('/api/upload', { method:'POST', body:fd });
      if (r.success) {
        setMsg({ type:'ok', text:`Berhasil import ${r.data?.record_count?.toLocaleString('id-ID') ?? 0} records` });
        setFile(null);
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

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, width:'100%' }}>
      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} t={t} />}

      <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:16, alignItems:'stretch', width:'100%' }}>
        {/* Upload - kiri di desktop, urutan ke-2 di mobile */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 2 : 1, background:t.cardbg, border:`1px solid ${t.borderCard}`, overflow:'hidden', boxShadow:t.shadowCard }}>
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
            <button onClick={handleUpload} disabled={!file||uploading} style={{ width:'100%', height:37, padding:'0 20px', borderRadius:8, fontSize:12, fontWeight:700, border:'none', background:file&&!uploading?'#6366f1':t.inputBg, color:file&&!uploading?'#fff':t.textMuted, cursor:file&&!uploading?'pointer':'not-allowed', fontFamily:FONT_MONO, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {uploading?(<><svg style={{ animation:'spin 0.8s linear infinite', width:12, height:12 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none"/></svg>Mengupload…</>):<><Upload size={12}/>Upload</>}
            </button>
          </div>
        </div>

        {/* Format Guide - kanan di desktop, urutan ke-1 (paling atas) di mobile */}
        <div style={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, order: isMobile ? 1 : 2, overflow:'hidden', display:'flex' }}>
          <FormatGuide t={t}/>
        </div>
      </div>

      <div style={{ background:t.cardbg, border:`1px solid ${t.borderCard}`,  overflow:'hidden', boxShadow:t.shadowCard }}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:24, height:24, borderRadius:7, background:'#10b98115', border:'1px solid #10b98128', display:'flex', alignItems:'center', justifyContent:'center' }}><FileSpreadsheet size={12} color="#10b981"/></div>
          <div style={{ fontSize:12, fontWeight:700, color:t.text }}>File Terupload</div>
          <div style={{ fontSize:10, color:t.textMuted, fontFamily:FONT_MONO, marginLeft:4 }}>{files.length} file</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ minWidth:480, width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['Nama File','Records','Status','Tanggal','Aksi'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:h==='Aksi'?'center':'left', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:t.textMuted, borderBottom:`1px solid ${t.border}`, fontFamily:FONT_MONO, background:t.tableHead }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {files.map((f,i)=>(
                <tr key={f.id} style={{ background:i%2===1?t.tableAlt:'transparent' }}>
                  <td style={{ padding:'9px 12px', color:t.text, fontFamily:FONT_MONO, fontSize:11 }}>{f.original_name}</td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:11 }}>{f.record_count.toLocaleString('id-ID')}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:8, fontSize:9, fontWeight:600, fontFamily:FONT_MONO, background:f.status==='completed'?t.posBg:f.status==='error'?t.negBg:t.warnBg, color:f.status==='completed'?t.posText:f.status==='error'?t.negText:t.warnText, border:`1px solid ${f.status==='completed'?t.posBorder:f.status==='error'?t.negBorder:t.warnBorder}` }}>
                      {f.status==='completed'?'✓ Selesai':f.status==='error'?'✗ Error':'⟳ Proses'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 12px', color:t.textSub, fontFamily:FONT_MONO, fontSize:10, whiteSpace:'nowrap' }}>{new Date(f.created_at).toLocaleDateString('id-ID',{day: '2-digit', month: 'short',year: 'numeric',hour: '2-digit', minute: '2-digit',})}</td>
                  <td style={{ padding:'9px 12px', textAlign:'center' }}>
                    <div style={{ display:'flex', justifyContent:'center', gap:5 }}>
                      <button onClick={()=>setPreviewFile(f)} disabled={f.status!=='completed'} style={{ width:26, height:26, borderRadius:6, background:'#6366f115', border:'1px solid #6366f128', display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:f.status==='completed'?'pointer':'not-allowed', opacity:f.status==='completed'?1:0.4 }} title="Preview"><Eye size={11} color="#6366f1"/></button>
                      <button onClick={()=>setDelTarget(f)} style={{ width:26, height:26, borderRadius:6, background:t.negBg, border:`1px solid ${t.negBorder}`, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }} title="Hapus"><Trash2 size={11} color={t.negText}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {files.length===0&&<tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:t.textMuted, fontSize:12, fontFamily:FONT_MONO }}>Belum ada file diupload</td></tr>}
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