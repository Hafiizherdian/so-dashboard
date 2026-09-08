'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Search, Filter, RefreshCw, X, ChevronUp, ChevronDown, Calendar, CheckCircle2,
} from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';
import { Label } from 'recharts';

interface Props { theme: Theme; }


// Sesuai bentuk balikan GET /api/wip (?upload_id= / ?tanggal= / default
// upload terbaru). Lihat app/api/wip/route.ts & app/api/wip/upload/route.ts.

export interface WipJobRow {
  id:         string;
  deskripsi:  string;
  nomor_jop:  string;
  up:         number;
  cetak_lbr:  number;
  embos_lbr:  number;
  plong_lbr:  number;
  pretel_pcs: number;
  wip_glue:   number;   // proses "WIP GLUE" (Pcs)
  wip_total:  number;   // proses "WIP TOTAL" (Pcs)
  bj_pcs:     number;   // "BARANG JADI" (Pcs)
}

export interface WipUploadInfo {
  id:         string;
  file_name:  string;
  tanggal:    string;         // ISO date
  status_wip: string | null;
  keterangan: string | null;
  created_at: string;
}

export interface WipHistoryItem {
  id:         string;
  file_name:  string;
  tanggal:    string;
  status_wip?: string | null;
  created_at: string;
  row_count:  number;
}

export interface WipApiResponse {
  success: boolean;
  data: {
    upload:  WipUploadInfo | null;
    jobs:    WipJobRow[];
    totals:  Record<string, number> | null;
    history: WipHistoryItem[];
  };
}

// HELPERS
// HELPERS
function fmtNum(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  
  // Paksa konversi ke tipe Number (jika aslinya terbaca sebagai string dari API)
  const num = Number(n);
  
  if (isNaN(num)) return '—';
  
  // Format ke standar Indonesia (titik untuk ribuan) dan buang desimal
  return num.toLocaleString('id-ID', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.substring(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]} ${d.getFullYear()}`;
}

// Warna badge status disesuaikan sama nilai umum di kolom "STATUS WIP" Excel.
function statusColor(status: string | null | undefined): { bg: string; border: string; text: string } {
  const s = (status ?? '').toUpperCase();
  if (s.includes('PROGRESS')) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#f59e0b' };
  if (s.includes('SELESAI') || s.includes('DONE')) return { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#4ade80' };
  if (s.includes('PENDING') || s.includes('TUNDA')) return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#f87171' };
  return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)', text: '#94a3b8' };
}

type SortKey =
  | 'nomor_jop'
  | 'deskripsi'
  | 'up'
  | 'cetak_lbr'
  | 'embos_lbr'
  | 'plong_lbr'
  | 'pretel_pcs'
  | 'wip_glue'
  | 'wip_total'
  | 'bj_pcs';
type SortDir = 'asc' | 'desc';

function useBreakpoint() {
  const [bp, setBp] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setBp(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return bp;
}

// COMPONENT
export default function WipTab({ theme }: Props) {
  const t  = tk[theme];
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  const [jobs, setJobs]         = useState<WipJobRow[]>([]);
  const [upload, setUpload]     = useState<WipUploadInfo | null>(null);
  const [history, setHistory]   = useState<WipHistoryItem[]>([]);
  const [loading, setLoading]   = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('wip_total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<WipJobRow | null>(null);

  const loadData = async (uploadId?: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (uploadId) p.set('upload_id', uploadId);
      const queryString = p.toString();
      const r: WipApiResponse = await apiJson(`/api/wip${queryString ? `?${queryString}` : ''}`);
      if (r.success) {
        setJobs(r.data.jobs ?? []);
        setUpload(r.data.upload ?? null);
        setHistory(r.data.history ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    // 1. Buang baris yang semua nilai kolom prosesnya kosong/0
    const nonEmptyJobs = jobs.filter(j => {
        const totalValue = 
        (Number(j.cetak_lbr) || 0) + 
        (Number(j.embos_lbr) || 0) + 
        (Number(j.plong_lbr) || 0) + 
        (Number(j.pretel_pcs) || 0) + 
        (Number(j.wip_glue) || 0) + 
        (Number(j.wip_total) || 0) + 
        (Number(j.bj_pcs) || 0);

        return totalValue > 0
    })

    // 2. Lanjutkan dengan filter pencarian jika ada
    if (!search) return nonEmptyJobs;
    const q = search.toLowerCase();
    return nonEmptyJobs.filter(j => 
      j.deskripsi.toLowerCase().includes(q) || 
      j.nomor_jop.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const totals = useMemo(() => {
    const sum = (key: keyof WipJobRow) => sorted.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    return {
      cetak_lbr: sum('cetak_lbr'),
      embos_lbr: sum('embos_lbr'),
      plong_lbr: sum('plong_lbr'),
      pretel_pcs: sum('pretel_pcs'),
      wip_glue: sum('wip_glue'),
      wip_total: sum('wip_total'),
      bj_pcs: sum('bj_pcs'),
    };
  }, [sorted]);

  // KPI
  const totalJob = filtered.length;
  const kpiCards = [
    { label: 'Cetak Lembar',     value: fmtNum(totals.cetak_lbr),  sub: 'lembar dalam proses',  color: t.card2text, bg: t.card2bg, border: t.card2border },
    { label: 'Embos Lembar',     value: fmtNum(totals.embos_lbr),  sub: 'lembar dalam proses',  color: '#f59e0b', bg: t.card1bg, border: t.card1border },
    { label: 'Plong Lembar',     value: fmtNum(totals.plong_lbr),  sub: 'lembar dalam proses',  color: t.card2text, bg: t.card2bg, border: t.card2border },
    { label: 'Pretel Pieces',    value: fmtNum(totals.pretel_pcs), sub: 'pieces dalam proses',  color: t.card2text, bg: t.card2bg, border: t.card2border },
    { label: 'WIP Glue',         value: fmtNum(totals.wip_glue),   sub: 'WIP dalam proses',     color: t.card2text, bg: t.card2bg, border: t.card2border},
    { label: 'WIP Total',        value: fmtNum(totals.wip_total),  sub: 'WIP Total',            color: t.card2text, bg: t.card2bg, border: t.card2border},
    { label: 'Barang Jadi',      value: fmtNum(totals.bj_pcs),     sub: 'Barang Jadi',          color: t.card2text, bg: t.card2bg, border: t.card2border},
  ];

  // styles
  const thS: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1,
    padding: '7px 10px', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: t.text, borderBottom: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, background: t.tableHead, whiteSpace: 'nowrap', cursor: 'pointer',
  };
  const tdS: React.CSSProperties = {
    padding: '7px 10px', fontFamily: FONT_MONO, fontSize: 11,
    borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap',
  };
  const tfS: React.CSSProperties = {
    position: 'sticky', bottom: 0, zIndex: 2,
    padding: '8px 10px', fontFamily: FONT_MONO, fontSize: 11, fontWeight: 800,
    color: t.text, background: t.tableHead, borderTop: `2px solid ${t.borderInput}`,
    whiteSpace: 'nowrap',
  };
  const inputS: React.CSSProperties = {
    height: 28, paddingLeft: 26, paddingRight: 28, fontSize: 11, borderRadius: 6,
    background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text,
    outline: 'none', width: 220, fontFamily: FONT_MONO,
  };
  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp size={9} color="#6366f1" /> : <ChevronDown size={9} color="#6366f1" />)
    : <ChevronUp size={9} color={t.textFaint} />;

  // Toolbar
  const SearchBox = (
    <div style={{ position: 'relative', flex: isMobile ? 1 : undefined }}>
      <Search size={11} color={t.textMuted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        type="text" placeholder="Cari deskripsi / nomor JOP…" value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
        style={{ ...inputS, width: isMobile ? '100%' : 220 }}
      />
      {searchInput && (
        <button onClick={() => { setSearchInput(''); setSearch(''); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 0 }}>
          <X size={10} />
        </button>
      )}
    </div>
  );

  // Pilih snapshot tanggal lain dari riwayat upload
  const TanggalFilter = (
    <select
      value={upload?.id ?? ''}
      onChange={e => loadData(e.target.value || undefined)}
      style={{
        height: 28, padding: '0 28px 0 10px', borderRadius: 6,
        background: t.filterbg, border: `1px solid ${t.borderInput}`, color: t.text,
        outline: 'none', fontSize: 11, fontFamily: FONT_MONO, cursor: 'pointer',
      }}
    >
      {history.length === 0 && upload && <option value={upload.id}>{fmtDate(upload.tanggal)}</option>}
      {history.map(h => (
        <option key={h.id} value={h.id}>{fmtDate(h.tanggal)} ({h.row_count} job)</option>
      ))}
    </select>
  );

  const Toolbar = isMobile || isTablet ? (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }} onClick={() => setFilterOpen(o => !o)}>
        <Filter size={12} color={t.textMuted} />
        <span style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, fontWeight: 600, flex: 1 }}>Filter</span>
        {filterOpen ? <ChevronUp size={13} color={t.textMuted} /> : <ChevronDown size={13} color={t.textMuted} />}
        <button onClick={e => { e.stopPropagation(); loadData(upload?.id); }} style={{ height: 26, width: 26, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSub }}>
          <RefreshCw size={11} />
        </button>
      </div>

      {filterOpen && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TanggalFilter}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SearchBox}
            <button onClick={() => setSearch(searchInput)} style={{ height: 28, padding: '0 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: FONT_MONO, flexShrink: 0 }}>
              Cari
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, padding: '10px 14px' }}>
      <Filter size={11} color={t.textMuted} />
      <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>Filter</span>
      {upload && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: t.textSub, fontFamily: FONT_MONO, padding: '3px 8px', borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}` }}>
          <Calendar size={10} /> {fmtDate(upload.tanggal)}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {TanggalFilter}
      {SearchBox}
      <button onClick={() => setSearch(searchInput)} style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: FONT_MONO }}>Cari</button>
      <button onClick={() => loadData(upload?.id)} style={{ height: 28, width: 28, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
        <RefreshCw size={12} />
      </button>
    </div>
  );

  const KpiRow = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(7,1fr)', gap: isMobile ? 8 : 12 }}>
      {kpiCards.map(card => (
        <div key={card.label} style={{ borderRadius: 13, padding: isMobile ? '10px 12px' : '12px 14px', background: card.bg, border: `1px solid ${card.border}` }}>
          <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 5 }}>{card.label}</div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
          <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginTop: 4 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );

  // Konfigurasi kolom sticky (Nomor JOP + Deskripsi tetap kelihatan saat scroll horizontal)
  const STICKY = {
    nomor_jop: { left: 0, width: 150 },
    deskripsi: { left: 150, width: 220 },
  };
  const getStickyTh = (key: keyof typeof STICKY, isLast = false): React.CSSProperties => ({
    position: 'sticky', top: 0, left: STICKY[key].left,
    minWidth: STICKY[key].width, maxWidth: STICKY[key].width, zIndex: 2,
    background: t.tableHead, borderRight: isLast ? `2px solid ${t.borderInput}` : undefined,
  });
  const getStickyTd = (key: keyof typeof STICKY, bg: string, isLast = false): React.CSSProperties => ({
    position: 'sticky', left: STICKY[key].left,
    minWidth: STICKY[key].width, maxWidth: STICKY[key].width, zIndex: 1,
    borderRight: isLast ? `2px solid ${t.borderInput}` : undefined, background: bg,
  } as React.CSSProperties);
  const getStickyTf = (key: keyof typeof STICKY, isLast = false): React.CSSProperties => ({
    position: 'sticky', left: STICKY[key].left, bottom: 0,
    minWidth: STICKY[key].width, maxWidth: STICKY[key].width, zIndex: 3,
    background: t.tableHead, borderRight: isLast ? `2px solid ${t.borderInput}` : undefined,
  });

  // Table (desktop/tablet)
  const DesktopTable = (
    <>
      <style>{`
        .hover-row:hover td:not(.sticky-col) { background-color: ${t.rowHover} !important; }
        .hover-row:hover td.sticky-col {
          background-color: ${t.tableHead} !important;
          background-image: linear-gradient(to right, ${t.rowHover}, ${t.rowHover}) !important;
        }
      `}</style>

      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...thS, ...getStickyTh('nomor_jop') }} onClick={() => toggleSort('nomor_jop')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Nomor JOP <SortIcon k="nomor_jop" /></span>
            </th>
            <th style={{ ...thS, ...getStickyTh('deskripsi', true) }} onClick={() => toggleSort('deskripsi')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Deskripsi <SortIcon k="deskripsi" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('up')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>UP <SortIcon k="up" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('cetak_lbr')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Cetak (Lbr) <SortIcon k="cetak_lbr" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('embos_lbr')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Embos (Lbr) <SortIcon k="embos_lbr" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('plong_lbr')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Plong/Rit (Lbr) <SortIcon k="plong_lbr" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('pretel_pcs')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Pretel (Pcs) <SortIcon k="pretel_pcs" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('wip_glue')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>WIP Glue (Pcs) <SortIcon k="wip_glue" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('wip_total')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>WIP Total (Pcs) <SortIcon k="wip_total" /></span>
            </th>
            <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('bj_pcs')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>Barang Jadi (Pcs) <SortIcon k="bj_pcs" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isAlt = i % 2 === 1;
            const rowBg = isAlt ? t.tableAlt : 'transparent';
            const stickyBg = isAlt ? t.tableAlt : t.cardbg;

            return (
              <tr key={row.id} className="hover-row" style={{ background: rowBg }} onClick={() => isMobile && setSelectedRow(row)}>
                <td className="sticky-col" style={{ ...tdS, ...getStickyTd('nomor_jop', stickyBg), color: t.text, fontWeight: 600 }}>{row.nomor_jop}</td>
                <td className="sticky-col" style={{ ...tdS, ...getStickyTd('deskripsi', stickyBg, true), color: t.text, whiteSpace: 'normal' }}>{row.deskripsi}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.up)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.cetak_lbr)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.embos_lbr)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.plong_lbr)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.pretel_pcs)}</td>
                <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.wip_glue)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmtNum(row.wip_total)}</td>
                <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtNum(row.bj_pcs)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...tfS, ...getStickyTf('nomor_jop') }}>TOTAL</td>
            <td style={{ ...tfS, ...getStickyTf('deskripsi', true), fontSize: 10 }}>{fmtNum(totalJob)} job</td>
            <td style={{ ...tfS, textAlign: 'right', color: t.textMuted }}>—</td>
            <td style={{ ...tfS, textAlign: 'right' }}>{fmtNum(totals.cetak_lbr)}</td>
            <td style={{ ...tfS, textAlign: 'right' }}>{fmtNum(totals.embos_lbr)}</td>
            <td style={{ ...tfS, textAlign: 'right' }}>{fmtNum(totals.plong_lbr)}</td>
            <td style={{ ...tfS, textAlign: 'right' }}>{fmtNum(totals.pretel_pcs)}</td>
            <td style={{ ...tfS, textAlign: 'right' }}>{fmtNum(totals.wip_glue)}</td>
            <td style={{ ...tfS, textAlign: 'right', color: '#f59e0b' }}>{fmtNum(totals.wip_total)}</td>
            <td style={{ ...tfS, textAlign: 'right', color: '#10b981' }}>{fmtNum(totals.bj_pcs)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );

  const MobileList = (
    <div style={{ padding: '4px 0' }}>
      {sorted.map((row, i) => (
        <div
          key={row.id}
          onClick={() => setSelectedRow(row)}
          style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, background: i % 2 === 1 ? t.tableAlt : 'transparent', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{row.nomor_jop}</span>
            <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>UP {row.up}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
            {row.deskripsi}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1, padding: '4px 6px', borderRadius: 6, background: t.inputBg }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>WIP TOTAL</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', fontFamily: FONT_MONO }}>{fmtNum(row.wip_total)}</span>
            </div>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1, padding: '4px 6px', borderRadius: 6, background: t.inputBg }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>BARANG JADI</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981', fontFamily: FONT_MONO }}>{fmtNum(row.bj_pcs)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const detailRow = (label: string, value: React.ReactNode, color?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px dashed ${t.border}` }}>
      <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: color ?? t.text, fontFamily: FONT_MONO, textAlign: 'right' }}>{value}</span>
    </div>
  );

  const DetailModal = selectedRow && (
    <div
      onClick={() => setSelectedRow(null)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: '16px 16px 0 0',
          width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
          padding: '14px 16px 102px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.text, fontFamily: FONT_MONO }}>{selectedRow.nomor_jop}</div>
            <div style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, marginTop: 2 }}>{selectedRow.deskripsi}</div>
          </div>
          <button
            onClick={() => setSelectedRow(null)}
            style={{ background: t.inputBg, border: `1px solid ${t.borderInput}`, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted, flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: t.inputBg, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginBottom: 2 }}>WIP TOTAL</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b', fontFamily: FONT_MONO }}>{fmtNum(selectedRow.wip_total)}</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: t.inputBg, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginBottom: 2 }}>BARANG JADI</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981', fontFamily: FONT_MONO }}>{fmtNum(selectedRow.bj_pcs)}</div>
          </div>
        </div>

        {detailRow('UP', fmtNum(selectedRow.up))}
        {detailRow('Cetak (Lbr)', fmtNum(selectedRow.cetak_lbr))}
        {detailRow('Embos (Lbr)', fmtNum(selectedRow.embos_lbr))}
        {detailRow('Plong/Rit (Lbr)', fmtNum(selectedRow.plong_lbr))}
        {detailRow('Pretel (Pcs)', fmtNum(selectedRow.pretel_pcs))}
        {detailRow('WIP Glue (Pcs)', fmtNum(selectedRow.wip_glue))}
      </div>
    </div>
  );

  const TableCard = (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
            Data WIP {upload ? `- ${fmtDate(upload.tanggal)}` : ''}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '80vh', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: t.text, fontFamily: FONT_MONO, fontSize: 11 }}>Memuat data…</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>Tidak ada data</div>
        ) : isMobile ? MobileList : DesktopTable}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      {Toolbar}
      {KpiRow}
      {TableCard}
      {DetailModal}
    </div>
  );
}