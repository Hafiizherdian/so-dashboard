'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Trash2, Filter, RefreshCw,
  CheckCircle, X, ClipboardList,
} from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }

interface WipJob {
  job_id:        string;
  no_urut:       number;
  nomor_jop:     string;
  nama_produk:   string;
  ukuran_kertas: string;
  up:            number;
  qty_jop:       number;
  qty_cetak:     number;
}

interface WipShift {
  job_id:  string;
  tanggal: string;
  shift:   number;
  qty:     number;
}

interface WipData {
  nama_mesin:   string;
  minggu_awal:  string | null;
  minggu_akhir: string | null;
  upload_id:    string | null;
  jobs:         WipJob[];
  shifts:       WipShift[];
  dates:        string[];
}

interface UploadRow {
  id:           string;
  nama_mesin:   string;
  minggu_awal:  string;
  minggu_akhir: string;
  file_name:    string;
  created_at:   string;
  total_jobs:   number;
}

const EMPTY_DATA: WipData = {
  nama_mesin: '', minggu_awal: null, minggu_akhir: null,
  upload_id: null, jobs: [], shifts: [], dates: [],
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  
  let d: Date;

  // Jika string mengandung format waktu lengkap UTC (ada huruf T dan Z)
  if (iso.includes('T') && iso.endsWith('Z')) {
    // Buat objek date langsung dari string ISO. Browser otomatis
    // mengonversi kembali 17 Mei 17:00 UTC menjadi 18 Mei 00:00 Lokal (WIB)
    d = new Date(iso);
  } else {
    // Jika string berupa tanggal bersih 'YYYY-MM-DD' (seperti data shift)
    const cleanIso = iso.includes('T') ? iso.split('T')[0] : iso;
    d = new Date(cleanIso + 'T00:00:00');
  }
  
  // Cek validitas date agar terhindar dari NaN
  if (isNaN(d.getTime())) return '—';

  // Ambil komponen tanggal lokal (menggunakan get component biasa, BUKAN getUTC)
  const dd  = String(d.getDate()).padStart(2, '0');
  const mon = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()];
  const yy  = String(d.getFullYear()).slice(2);
  
  return `${dd}-${mon}-${yy}`;
}

function fmtNum(n: number): string {
  if (!n) return '';
//   if (n >= 1000) return `${(n / 1000).toFixed(0)}rb`;
  return n.toLocaleString('id-ID');
}

export default function WipTab({ theme }: Props) {
  const t = tk[theme];

  const [data,           setData]           = useState<WipData>(EMPTY_DATA);
  const [uploads,        setUploads]        = useState<UploadRow[]>([]);
  const [mesinList,      setMesinList]      = useState<string[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [delTarget,      setDelTarget]      = useState<UploadRow | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [toast,          setToast]          = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<string>('');
  const [filterMesin,    setFilterMesin]    = useState<string>('all');

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadUploads = async () => {
    const r = await apiJson('/api/wip?list=1');
    if (r.success) {
      setUploads(r.data ?? []);
      setMesinList(r.mesin_list ?? []);
    }
  };

  const loadData = async (uploadId?: string, mesin?: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (uploadId) p.set('upload_id', uploadId);
      else if (mesin && mesin !== 'all') p.set('mesin', mesin);
      const r = await apiJson(`/api/wip?${p}`);
      if (r.success) setData(r.data ?? EMPTY_DATA);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadUploads().then(() => loadData());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(selectedUpload || undefined, filterMesin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUpload, filterMesin]);

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const r = await apiJson(`/api/wip?id=${delTarget.id}`, { method: 'DELETE' });
      if (r.success) {
        showToast('ok', 'Data berhasil dihapus');
        setDelTarget(null);
        if (selectedUpload === delTarget.id) setSelectedUpload('');
        await loadUploads();
        await loadData();
      } else showToast('err', r.error || 'Gagal menghapus');
    } finally { setDeleting(false); }
  };

  // ── FIX: normalize semua job_id ke string agar lookup tidak miss ──────────
  const shiftIndex = useMemo(() => {
    const idx: Record<string, number> = {};
    data.shifts.forEach(s => {
      // key: "jobId_tanggal_shift"
      idx[`${String(s.job_id)}_${s.tanggal}_${Number(s.shift)}`] = Number(s.qty);
    });
    return idx;
  }, [data.shifts]);

  // KPI
  const totalQtyJop   = data.jobs.reduce((s, j) => s + Number(j.qty_jop),   0);
  const totalQtyCetak = data.jobs.reduce((s, j) => s + Number(j.qty_cetak), 0);
  const totalShiftQty = data.shifts.reduce((s, sh) => s + Number(sh.qty),   0);
  const progressPct   = totalQtyJop > 0 ? (totalQtyCetak / totalQtyJop) * 100 : 0;

  // Total per (tanggal, shift)
  const colTotals = useMemo(() => {
    const tot: Record<string, number> = {};
    data.shifts.forEach(s => {
      const k = `${s.tanggal}_${Number(s.shift)}`;
      tot[k] = (tot[k] ?? 0) + Number(s.qty);
    });
    return tot;
  }, [data.shifts]);

  const filteredUploads = filterMesin === 'all'
    ? uploads
    : uploads.filter(u => u.nama_mesin === filterMesin);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const thS: React.CSSProperties = {
    padding: '7px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: t.textMuted, borderBottom: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, background: t.tableHead, whiteSpace: 'nowrap',
  };
  const tdS: React.CSSProperties = {
    padding: '7px 10px', fontFamily: FONT_MONO, fontSize: 11,
    borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap',
  };
  const selS: React.CSSProperties = {
    height: 28, padding: '0 8px', fontSize: 11, borderRadius: 6,
    background: t.inputBg, border: `1px solid ${t.borderInput}`,
    color: t.text, outline: 'none', fontFamily: FONT_MONO, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: t.cardbg, border: `1px solid ${toast.type === 'ok' ? t.posBorder : t.negBorder}`, color: toast.type === 'ok' ? t.posText : t.negText, fontSize: 12, fontFamily: FONT_MONO, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast.type === 'ok' ? <CheckCircle size={13} /> : <X size={13} />}{toast.text}
        </div>
      )}

      {/* ── Toolbar filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, padding: '10px 14px' }}>
        <Filter size={11} color={t.textMuted} />
        <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>Filter</span>

        <select style={selS} value={filterMesin} onChange={e => { setFilterMesin(e.target.value); setSelectedUpload(''); }}>
          <option value="all">Semua Mesin</option>
          {mesinList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select style={{ ...selS, minWidth: 230 }} value={selectedUpload} onChange={e => setSelectedUpload(e.target.value)}>
          <option value="">{filteredUploads.length ? 'Terbaru' : '— Belum ada upload —'}</option>
          {filteredUploads.map(u => (
            <option key={u.id} value={u.id}>
              {u.nama_mesin} · {fmtDate(u.minggu_awal)}–{fmtDate(u.minggu_akhir)} ({u.total_jobs} JOP)
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { loadUploads(); loadData(selectedUpload || undefined, filterMesin); }}
          style={{ height: 28, width: 28, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>

        {selectedUpload && (
          <button
            onClick={() => { const u = uploads.find(u => u.id === selectedUpload); if (u) setDelTarget(u); }}
            style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, background: t.negBg, border: `1px solid ${t.negBorder}`, color: t.negText, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: FONT_MONO }}
          >
            <Trash2 size={11} />Hapus
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total JOP',       value: String(data.jobs.length),                     sub: data.nama_mesin || '—',              color: t.card1text, bg: t.card1bg, border: t.card1border },
          { label: 'Qty JOP',         value: totalQtyJop.toLocaleString('id-ID'),           sub: 'target cetak',                      color: t.card2text, bg: t.card2bg, border: t.card2border },
          { label: 'Qty Cetak',       value: totalQtyCetak.toLocaleString('id-ID'),         sub: `${progressPct.toFixed(1)}% dari JOP`, color: '#10b981',   bg: t.card2bg, border: t.card2border },
        //   { label: 'Realisasi Shift', value: totalShiftQty.toLocaleString('id-ID'),         sub: `${data.dates.length * 2} slot shift`, color: t.card4text, bg: t.card4bg, border: t.card4border },
        ].map(card => (
          <div key={card.label} style={{ borderRadius: 13, padding: '14px 16px', background: card.bg, border: `1px solid ${card.border}` }}>
            <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 7 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 9.5, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 5 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar global ── */}
      {totalQtyJop > 0 && (
        <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO }}>Progress Keseluruhan</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: progressPct >= 100 ? '#10b981' : t.card1text, fontFamily: FONT_MONO }}>{progressPct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: t.borderCard, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(progressPct, 100)}%`, background: progressPct >= 100 ? '#10b981' : '#6366f1', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* ── Tabel pivot ── */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={12} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{data.nama_mesin || 'WIP Produksi'}</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
              {data.minggu_awal && data.minggu_akhir
                ? `${fmtDate(data.minggu_awal)} – ${fmtDate(data.minggu_akhir)} · ${data.jobs.length} JOP · ${data.dates.length} hari`
                : 'Belum ada data — upload file Excel WIP di tab Upload WIP'}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 11 }}>Memuat data…</div>
          ) : data.jobs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>
              Belum ada data Plan.<br />
              <span style={{ fontSize: 10 }}>Upload file Excel Plan di tab "Upload Plan".</span>
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...thS, textAlign: 'center', borderRight: `1px solid ${t.border}` }}>No</th>
                  <th rowSpan={2} style={{ ...thS, minWidth: 120, borderRight: `1px solid ${t.border}` }}>Nomor JOP</th>
                  <th rowSpan={2} style={{ ...thS, minWidth: 180, borderRight: `1px solid ${t.border}` }}>Nama Produk</th>
                  <th rowSpan={2} style={{ ...thS, minWidth: 160, borderRight: `1px solid ${t.border}` }}>Ukuran Kertas</th>
                  <th rowSpan={2} style={{ ...thS, textAlign: 'right', borderRight: `1px solid ${t.border}` }}>UP</th>
                  <th rowSpan={2} style={{ ...thS, textAlign: 'right', borderRight: `1px solid ${t.border}` }}>Qty JOP</th>
                  <th rowSpan={2} style={{ ...thS, textAlign: 'right', borderRight: `1px solid ${t.border}`, minWidth: 90 }}>Qty Cetak</th>
                  {data.dates.map((d, di) => (
                    <th key={d} colSpan={2} style={{ ...thS, textAlign: 'center', borderRight: `1px solid ${t.border}`, background: di % 2 === 0 ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.07)', color: di % 2 === 0 ? t.card1text : t.card2text, minWidth: 80 }}>
                      {fmtDate(d)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {data.dates.map((d, di) => (
                    <React.Fragment key={d}>
                      {[1, 2].map(sh => (
                        <th key={sh} style={{ ...thS, textAlign: 'center', borderRight: sh === 2 ? `1px solid ${t.border}` : undefined, background: di % 2 === 0 ? 'rgba(99,102,241,0.04)' : 'rgba(16,185,129,0.03)', fontSize: 8, minWidth: 40 }}>
                          {sh === 1 ? 'I' : 'II'}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.jobs.map((job, i) => {
                  const qtyJop   = Number(job.qty_jop);
                  const qtyCetak = Number(job.qty_cetak);
                  const pct    = qtyJop > 0 ? (qtyCetak / qtyJop) * 100 : 0;
                  const isLow  = pct < 30 && qtyJop > 0;
                  const isDone = pct >= 100;
                  const jobIdStr = String(job.job_id);

                  return (
                    <tr
                      key={job.job_id}
                      style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                    >
                      <td style={{ ...tdS, textAlign: 'center', color: t.textMuted, borderRight: `1px solid ${t.border}`, fontSize: 10 }}>{job.no_urut}</td>
                      <td style={{ ...tdS, color: t.text, fontWeight: 600, borderRight: `1px solid ${t.border}`, fontSize: 10 }}>{job.nomor_jop}</td>
                      <td style={{ ...tdS, color: t.textSub, borderRight: `1px solid ${t.border}` }}>{job.nama_produk}</td>
                      <td style={{ ...tdS, color: t.textMuted, fontSize: 10, borderRight: `1px solid ${t.border}` }}>{job.ukuran_kertas}</td>
                      <td style={{ ...tdS, textAlign: 'right', color: t.textMuted, borderRight: `1px solid ${t.border}` }}>{job.up}</td>
                      <td style={{ ...tdS, textAlign: 'right', color: t.text, fontWeight: 600, borderRight: `1px solid ${t.border}` }}>{qtyJop.toLocaleString('id-ID')}</td>
                      <td style={{ ...tdS, textAlign: 'right', borderRight: `1px solid ${t.border}` }}>
                        <span style={{ color: isDone ? '#10b981' : isLow ? t.negText : t.text, fontWeight: 700 }}>
                          {qtyCetak.toLocaleString('id-ID')}
                        </span>
                        <div style={{ height: 3, borderRadius: 2, background: t.borderCard, overflow: 'hidden', marginTop: 3, width: 56, marginLeft: 'auto' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: isDone ? '#10b981' : isLow ? '#ef4444' : '#6366f1', borderRadius: 2 }} />
                        </div>
                      </td>

                      {/* ── Kolom shift — menggunakan shiftIndex yang sudah di-fix ── */}
                      {data.dates.map((d, di) => (
                        <React.Fragment key={d}>
                          {[1, 2].map(sh => {
                            const lookupKey = `${jobIdStr}_${d}_${sh}`;
                            const qty = shiftIndex[lookupKey] ?? 0;
                            return (
                              <td
                                key={sh}
                                style={{
                                  ...tdS,
                                  textAlign: 'center',
                                  borderRight: sh === 2 ? `1px solid ${t.border}` : undefined,
                                  background: qty > 0
                                    ? (di % 2 === 0 ? 'rgba(99,102,241,0.07)' : 'rgba(16,185,129,0.06)')
                                    : undefined,
                                  color: qty > 0
                                    ? (di % 2 === 0 ? t.card1text : t.card2text)
                                    : t.textFaint,
                                  fontSize: 10,
                                  fontWeight: qty > 0 ? 700 : 400,
                                }}
                              >
                                {qty > 0 ? fmtNum(qty) : '—'}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}

                {/* TOTAL row */}
                <tr style={{ background: t.tableHead, borderTop: `2px solid ${t.border}` }}>
                  <td style={{ ...tdS, borderRight: `1px solid ${t.border}` }} />
                  <td colSpan={2} style={{ ...tdS, fontWeight: 800, color: t.text, fontSize: 10, borderRight: `1px solid ${t.border}` }}>TOTAL</td>
                  <td style={{ ...tdS, borderRight: `1px solid ${t.border}` }} />
                  <td style={{ ...tdS, borderRight: `1px solid ${t.border}` }} />
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, color: t.text, borderRight: `1px solid ${t.border}` }}>{totalQtyJop.toLocaleString('id-ID')}</td>
                  <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, color: t.text, borderRight: `1px solid ${t.border}` }}>{totalQtyCetak.toLocaleString('id-ID')}</td>
                  {data.dates.map((d, di) => (
                    <React.Fragment key={d}>
                      {[1, 2].map(sh => {
                        const tot = colTotals[`${d}_${sh}`] ?? 0;
                        return (
                          <td key={sh} style={{ ...tdS, textAlign: 'center', fontWeight: 700, borderRight: sh === 2 ? `1px solid ${t.border}` : undefined, color: tot > 0 ? (di % 2 === 0 ? t.card1text : t.card2text) : t.textFaint, fontSize: 10, background: tot > 0 ? (di % 2 === 0 ? 'rgba(99,102,241,0.09)' : 'rgba(16,185,129,0.08)') : undefined }}>
                            {tot > 0 ? fmtNum(tot) : '—'}
                          </td>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {delTarget && (
        <div onClick={e => e.target === e.currentTarget && setDelTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 16, padding: 22, width: '100%', maxWidth: 400, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: t.negBg, border: `1px solid ${t.negBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={16} color={t.negText} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 5 }}>Hapus Data Plan</div>
                <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.6 }}>
                  Yakin menghapus <strong>{delTarget.nama_mesin}</strong> periode{' '}
                  {fmtDate(delTarget.minggu_awal)}–{fmtDate(delTarget.minggu_akhir)}?<br />
                  <span style={{ color: t.negText }}>Semua {delTarget.total_jobs} JOP dan data shift akan terhapus permanen.</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDelTarget(null)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.inputBg, color: t.textSub, border: `1px solid ${t.borderInput}`, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}