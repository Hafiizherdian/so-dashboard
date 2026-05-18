'use client'

import React, { useState, useRef} from 'react';
import {
  Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Layers,
  Thermometer,
} from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';
 
interface Props { theme: Theme; }

interface HistoryRow {
    id: string;
    filename: string;
    periode: string;
    record_count: number;
    uploaded_at: string;
}

export default function UploadKertasTab({ theme }: Props) {
    const t = tk[theme]
    const [file, setFile] = useState<File | null>(null)
    const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7));
    const [dragging, setDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [msg, setMsg] = useState<{type: 'sip wes' | 'loh gagal'; text: string} | null>(null)
    const [history, sethistory] = useState<HistoryRow[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = (f: File) => {
        if(!/\.xlsx?$/.test(f.name)) {
            setMsg({type: 'loh gagal', text: 'File harus berformat .xls atau .xlsx'})
            return;
        }
        setFile(f)
        setMsg(null)
    }

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)
        setMsg(null)
        const fd = new FormData()
        fd.append('file', file)
        fd.append('periode', periode)
        try{
            const r = await apiJson('api/kertas/upload', {method: 'POST', body: fd})
            if(r.succes){
                const count = r.count ?? 0
                setMsg({ type: 'sip wes', text: `Berhasil import ${count.toLocaleString('id-ID')} records untuk periode ${periode}` })
                setFile(null)
                sethistory(h => [{id: r.id, filename: file.name, periode, record_count: count, uploaded_at: new Date().toISOString()}, ...h])
            }
        } catch (error) {
            setMsg({ type: 'loh gagal', text: 'Gagal mengunggah file' })
        } finally {
            setUploading(false)
        }
    }

    const inp: React.CSSProperties = {
        padding: '9px 12px', fontSize:14, borderRadius:8,
        background: t.inputBg, border: `1px solid ${t.borderInput}`,
        color: t.text, outline: 'none', fontFamily: FONT_MONO,
    }

    return (
        <div style={{display:'flex', flexDirection:'column', gap:16, padding:16}}>
            <style>{`@Keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }`}</style>
        
        {/* Format Guide */}
              <div style={{
        padding: '11px 14px', borderRadius: 10,
        background: t.infoBg, border: `1px solid ${t.infoBorder}`,
        fontSize: 11, color: t.infoText, fontFamily: FONT_MONO, lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Format kolom Excel yang diharapkan:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          {['Produk','Jenis Kertas','Gramasi','Merk','L (lebar)','P (panjang)','Unit','Saldo Awal','Masuk','Keluar','Keterangan'].map(col => (
            <span key={col} style={{ padding: '1px 7px', borderRadius: 5, background: t.inputBg, border: `1px solid ${t.infoBorder}`, fontSize: 10 }}>{col}</span>
          ))}
        </div>
      </div>

              <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={12} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Upload File Stok Kertas</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>Data akan ditambahkan ke tabel Stok Level</div>
          </div>
        </div>
 
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: msg.type === 'sip wes' ? t.posBg : t.negBg, border: `1px solid ${msg.type === 'sip wes' ? t.posBorder : t.negBorder}`, color: msg.type === 'sip wes' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO }}>
              {msg.type === 'sip wes' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span style={{ flex: 1 }}>{msg.text}</span>
              <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={11} /></button>
            </div>
          )}
 
          {/* Periode selector */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 5, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Periode *
            </label>
            <input style={inp} type="month" value={periode} onChange={e => setPeriode(e.target.value)} />
          </div>
 
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => !file && inputRef.current?.click()}
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
                <div style={{ width: 44, height: 44, borderRadius: 11, background: t.inputBg, border: `1.5px dashed ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Upload size={20} color={dragging ? '#6366f1' : t.textMuted} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
                  {dragging ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih file'}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted }}>Mendukung .xlsx · .xls · .csv</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: t.posBg, border: `1px solid ${t.posBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileSpreadsheet size={18} color={t.posText} />
                </div>
                <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  style={{ width: 26, height: 26, borderRadius: 7, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={11} color={t.negText} />
                </button>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
 
          {/* Upload button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                height: 38, padding: '0 24px', borderRadius: 9, fontSize: 12, fontWeight: 700,
                border: 'none',
                background: file && !uploading ? '#6366f1' : t.inputBg,
                color: file && !uploading ? '#fff' : t.textMuted,
                cursor: file && !uploading ? 'pointer' : 'not-allowed',
                fontFamily: FONT_MONO,
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: file && !uploading ? '0 2px 10px rgba(99,102,241,0.3)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {uploading ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Mengupload…
                </>
              ) : (
                <><Upload size={13} />Upload Stok Kertas</>
              )}
            </button>
          </div>
        </div>
      </div>
 
      {/* Session history */}
      {history.length > 0 && (
        <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 14, overflow: 'hidden', boxShadow: t.shadowCard }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 7, background: '#10b98115', border: '1px solid #10b98128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={12} color="#10b981" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Riwayat Upload Sesi Ini</div>
            <span style={{ marginLeft: 4, fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>{history.length} file</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 480, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Nama File', 'Periode', 'Records', 'Status', 'Waktu'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                    <td style={{ padding: '9px 12px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.filename}</td>
                    <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.periode}</td>
                    <td style={{ padding: '9px 12px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{row.record_count.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: t.posBg, color: t.posText, border: `1px solid ${t.posBorder}` }}>
                        ✓ Selesai
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10, whiteSpace: 'nowrap' }}>
                      {new Date(row.uploaded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

