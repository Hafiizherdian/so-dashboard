'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { List, Trash2 } from 'lucide-react';
import { Theme, tk, FONT_MONO, Tokens } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

// --- Types ---
interface Props { theme: Theme; }
type MsgState = { type: 'ok' | 'err'; text: string } | null;

interface ProductRow {
  id: string; nama_brand: string; kode_brand: string; kategori: string | null; kode_pabrik: string;
  pabrik: string | null; batang_per_bks: number | null; bks_per_slop: number | null; slop_per_bal: number | null;
  bal_per_dos: number | null; keterangan: string | null; jenis: string; up: number | null; kertas: string | null;
  gsm: number | null; l: number | null; p: number | null; kg_per_rim: number | null; qty_pcs: number | null;
  qty_lembar: number | null; qty_rim: number | null; qty_ton: number | null;
}

// --- MAIN EXPORT COMPONENT ---
export default function MasterProdukTab({ theme }: Props) {
  const t = tk[theme];

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<MsgState>(null);
  const [delTarget, setDelTarget] = useState<ProductRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductRow>>({});

  useEffect(() => {
    apiJson('/api/produk').then(r => {
      if (r.success) setProducts(r.data ?? []);
      else setMsg({ type: 'err', text: r.error || 'Gagal' });
      setLoading(false);
    }).catch(() => { setMsg({ type: 'err', text: 'Koneksi gagal' }); setLoading(false); });
  }, []);

  const handleDeleteProduct = async () => {
    if (!delTarget) return;
    const r = await apiJson(`/api/produk?id=${delTarget.id}`, { method: 'DELETE' });
    if (r.success) {
      setProducts(prev => prev.filter(p => p.id !== delTarget.id));
      setMsg({ type: 'ok', text: 'Dihapus' });
    } else { setMsg({ type: 'err', text: r.error || 'Gagal hapus' }); }
    setDelTarget(null);
  };

  const handleSaveEdit = async (id: string) => {
    const payload = { ...editForm, id };
    const r = await apiJson('/api/produk', { method: 'PUT', body: JSON.stringify(payload) });
    if (r.success) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...editForm } as ProductRow : p));
      setMsg({ type: 'ok', text: 'Tersimpan' });
      setEditingId(null);
    } else { setMsg({ type: 'err', text: r.error || 'Gagal simpan' }); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => (p.nama_brand||'').toLowerCase().includes(q) || (p.kode_pabrik||'').toLowerCase().includes(q));
  }, [search, products]);

  const thS: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: t.textSub, border: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead, whiteSpace: 'nowrap' };
  const tdStr: React.CSSProperties = { padding: '7px 10px', color: t.text, fontFamily: FONT_MONO, fontSize: 11, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' };

  // --- Konfigurasi Lebar & Posisi Kiri untuk 3 kolom pertama ---
  const STICKY = {
    brand:     { left: 0,   width: 180 }, // mulai dari 0
    kodeBrand: { left: 180, width: 120 }, // 0 + 180
    pabrik:    { left: 300, width: 220 }, // 180 + 120
  };

  const getStickyTh = (key: keyof typeof STICKY, isLast = false): React.CSSProperties => ({
    position: 'sticky',
    top: 0,
    left: STICKY[key].left,
    minWidth: STICKY[key].width,
    maxWidth: STICKY[key].width,
    zIndex: 2, // Header sticky butuh z-index lebih tinggi
    background: t.tableHead,
    borderRight: isLast ? `2px solid ${t.borderInput}` : `1px solid ${t.border}`,
  });

  const getStickyTd = (key: keyof typeof STICKY, bg: string, isLast = false): React.CSSProperties => ({
    position: 'sticky',
    left: STICKY[key].left,
    minWidth: STICKY[key].width,
    maxWidth: STICKY[key].width,
    zIndex: 1,
    borderRight: isLast ? `2px solid ${t.borderInput}` : `1px solid ${t.border}`,
    background: bg,
    '--sticky-bg': bg,
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
        
        {/* Header Control */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <List size={12} color={t.text} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Master Produk</div>
          <input type="text" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11, fontFamily: FONT_MONO, borderRadius: 6, border: `1px solid ${t.borderInput}`, background: t.inputBg, color: t.text, outline: 'none' }} />
        </div>

        {/* Tabel */}
        <div style={{ overflowX: 'auto', minHeight: 300 }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center', fontSize: 11, fontFamily: FONT_MONO, color: t.text }}>Memuat...</div> : (
            <table style={{ minWidth: 1000, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {/* Gunakan getStickyTh pada 3 kolom pertama */}
                  <th style={{ ...thS, ...getStickyTh('brand'), color: t.text }}>Brand</th>
                  <th style={{ ...thS, ...getStickyTh('kodeBrand'), color: t.text }}>Kode Brand</th>
                  <th style={{ ...thS, ...getStickyTh('pabrik', true), color: t.text }}>Pabrik</th>
                  
                  {/* Sisa kolom normal */}
                  <th style={{ ...thS, color: t.text}}>Jenis</th>
                  <th style={{ ...thS, color: t.text}}>Up</th>
                  <th style={{ ...thS, color: t.text}}>Batang per bks</th>
                  <th style={{ ...thS, color: t.text}}>Bungkus per slop</th>
                  <th style={{ ...thS, color: t.text}}>Slop per bal</th>
                  <th style={{ ...thS, color: t.text}}>Bal per dos</th>
                  <th style={{ ...thS, color: t.text}}>Kertas</th>
                  <th style={{ ...thS, color: t.text}}>GSM</th>
                  <th style={{ ...thS, color: t.text}}>Lebar</th>
                  <th style={{ ...thS, color: t.text}}>Panjang</th>
                  <th style={{ ...thS, color: t.text}}>KG/Ream</th>
                  <th style={{ ...thS, color: t.text}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  // Gunakan warna solid, bukan transparent, agar sticky tidak tembus pandang
                  const rowBg = i % 2 === 1 ? t.tableAlt : t.cardbg;

                  return (
                    <tr key={r.id} style={{ background: rowBg }}>
                      {/* Gunakan getStickyTd pada 3 kolom pertama */}
                      <td style={{ ...tdStr, ...getStickyTd('brand', rowBg) }}>{r.nama_brand || '-'}</td>
                      <td style={{ ...tdStr, ...getStickyTd('kodeBrand', rowBg) }}>{r.kode_brand || '-'}</td>
                      <td style={{ ...tdStr, ...getStickyTd('pabrik', rowBg, true) }}>{r.pabrik || r.kode_pabrik}</td>
                      
                      {/* Sisa kolom normal */}
                      <td style={tdStr}>{r.jenis || '-'}</td>
                      <td style={tdStr}>{r.up || '-'}</td>
                      <td style={tdStr}>{r.batang_per_bks || '-'}</td>
                      <td style={tdStr}>{r.bks_per_slop || '-'}</td>
                      <td style={tdStr}>{r.slop_per_bal || '-'}</td>
                      <td style={tdStr}>{r.bal_per_dos || '-'}</td>
                      <td style={tdStr}>{r.kertas || '-'}</td>
                      <td style={tdStr}>{r.gsm || '-'} gr</td>
                      <td style={tdStr}>{r.l || '-'} cm</td>
                      <td style={tdStr}>{r.p || '-'} cm</td>
                      <td style={tdStr}>{r.kg_per_rim || '-'} Kg</td>
                      <td style={{ ...tdStr, textAlign: 'center' }}>
                        <button onClick={() => setDelTarget(r)} style={{ width: 22, height: 22, borderRadius: 5, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Trash2 size={10} color={t.negText} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Delete (Tetap sama) */}
        {delTarget && (
          <div onClick={() => setDelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.cardbg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24, maxWidth: 400, width: '100%' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 10 }}>Hapus Produk</div>
              <div style={{ fontSize: 12, color: t.textSub, marginBottom: 20 }}>Yakin hapus <strong>{delTarget.nama_brand}</strong>?</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setDelTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text, cursor: 'pointer' }}>Batal</button>
                <button onClick={handleDeleteProduct} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, background: '#dc2626', border: 'none', color: '#fff', cursor: 'pointer' }}>Hapus</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}