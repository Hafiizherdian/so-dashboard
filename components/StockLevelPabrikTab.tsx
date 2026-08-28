'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  Layers, Search, Filter, RefreshCw, X, ChevronUp, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';
import { STOCK_LEVEL_COLUMNS, stockColId, isStockColId, stripStockColPrefix, Role } from '@/lib/menu';

interface Props { theme: Theme; }

// ══════════════════════════════════════════════════════════
// KONTRAK DATA (API CONTRACT)
// Backend cukup mengembalikan bentuk ini di /api/stock-level-pabrik
// Semua nilai yang berasal dari upload (stok pabrik, pengiriman SSS,
// stok aktual, WIP, BJ, kiriman, plan produksi) diisi backend — kalau
// upload untuk periode itu belum ada, kirim 0 / null, jangan di-skip.
//
// jenis_etiket & tipe adalah 2 DIMENSI TERPISAH:
//   jenis_etiket (Level 1, dari section Excel)  : 'UV' | 'Konven' | '-'
//   tipe         (Level 2, dari prefix baris)   : 'Etiket' | 'Inner' | 'Dos' | 'Slop Dos'
// Nested: tipe selalu ada DI DALAM salah satu jenis_etiket.
// ══════════════════════════════════════════════════════════

export interface StockLevelRawRow {
  id:           string;                 // kode_pabrik + kode_brand + jenis_etiket + tipe, unik per baris
  jenis:        string;                 // dari products.jenis: 'ETIKET' | 'DOS'
  jenis_etiket: string | null;          // Level 1: 'UV' | 'Konven' | '-'
  tipe:         string | null;          // Level 2: 'Etiket' | 'Inner' | 'Dos' | 'Slop Dos'
  kode_brand:   string;
  kode_pabrik:  string;
  nama_produk:  string;          // nama produk / deskripsi etiket, PERSIS dari Excel Stock Level
  up:           number | null;          // dari products.up

  // Data upload mingguan
  stok_pabrik:  number;        // "Stok Pabrik [periodeAwal]"
  pengiriman:   number;     // "Pengiriman SSS [periodeAwal - periodeAkhir]"
  stok_aktual:  number;        // "Stok Aktual [periodeAkhir]" — dari upload minggu sebelumnya

  // Sudah dihitung backend dari MSMR (4 minggu terakhir, dikonversi Dos → bungkus
  // pakai products.bks_per_slop * slop_per_bal * bal_per_dos * purchase_order_quota)
  pemakaian_per_bulan: number;

  // Upload manual per item (fitur upload menyusul — kirim null kalau belum ada)
  wip:          number | null;
  bj:           number | null;
  kiriman:      number | null;
  plan_produksi: number | null;
  keterangan:   string | null;
}

export interface StockLevelApiResponse {
  success: boolean;
  data: {
    periode_awal: string;   // ISO date, contoh 2026-08-07
    periode_akhir: string;  // ISO date, contoh 2026-08-14
    rows: StockLevelRawRow[];
  };
}

// HASIL KALKULASI
export interface StockLevelComputedRow extends StockLevelRawRow {
  estimasi_kebutuhan: number;          // pemakaian_per_hari * 6
  estimasi_stok: number;               // stok_pabrik + pengiriman_sss - estimasi_kebutuhan
  pemakaian_per_minggu: number;        // pemakaian_per_bulan / 4
  pemakaian_per_hari: number;          // pemakaian_per_bulan / 24
  stok_level_pabrik: number | null;    // dalam satuan HARI
  stok_level_pabrik_wip_bj: number | null; // dalam satuan HARI, sudah + pengiriman SSS
  stok_level_pabrik_wip_bj_plan: number | null;
  stok_level_pabrik_wip_so: number | null;
}

// Ambang batas warna status stok (dalam hari). Ubah di sini kalau perlu.
const STOCK_LEVEL_DANGER  = 7;
const STOCK_LEVEL_WARNING = 14;

function computeRow(raw: StockLevelRawRow): StockLevelComputedRow {
  const pemakaianPerBulan  = raw.pemakaian_per_bulan || 0;
  const pemakaianPerMinggu = pemakaianPerBulan / 4;
  const pemakaianPerHari   = pemakaianPerBulan / 24;

  const estimasiKebutuhan = pemakaianPerHari * 6;
  const estimasiStok = (raw.stok_pabrik || 0) + (raw.pengiriman || 0) - estimasiKebutuhan;

  const stokAktual = raw.stok_aktual || 0;
  // Poin 9 & 10: kalau stok aktual > 0 pakai stok aktual, kalau tidak pakai estimasi stok
  const baseStok = stokAktual > 0 ? stokAktual : estimasiStok;

  const wip = raw.wip ?? 0;
  const bj  = raw.bj ?? 0;
  const pengirimanSss = raw.kiriman || 0;
  const planProduksi = raw.plan_produksi || 0

  // Guard: kalau stok_pabrik, pengiriman_sss, dan stok_aktual semuanya kosong/0,
  // berarti belum ada data upload real buat item ini — jangan hitung stock level
  const noRealStockData = (raw.stok_pabrik || 0) === 0
    && pengirimanSss === 0
    && stokAktual === 0;

  const stokLevelPabrik = (pemakaianPerHari > 0 && !noRealStockData)
    ? baseStok / pemakaianPerHari
    : null;

  const stokLevelPabrikWipBj = (pemakaianPerHari > 0 && !noRealStockData)
    ? (baseStok + wip + bj + pengirimanSss) / pemakaianPerHari
    : null;

  const stokLevelPabrikWipBjPlan = (pemakaianPerHari > 0 && !noRealStockData)
    ? (baseStok + wip + bj + pengirimanSss + planProduksi) / pemakaianPerHari
    : null

  return {
    ...raw,
    pemakaian_per_minggu: pemakaianPerMinggu,
    pemakaian_per_hari: pemakaianPerHari,
    estimasi_kebutuhan: estimasiKebutuhan,
    estimasi_stok: estimasiStok,
    stok_level_pabrik: stokLevelPabrik,
    stok_level_pabrik_wip_bj: stokLevelPabrikWipBj,
    stok_level_pabrik_wip_bj_plan: stokLevelPabrikWipBjPlan,
    stok_level_pabrik_wip_so: null,
  };
}

// HELPERS
function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDay(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} hr`;
}
function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]}`;
}

type SortKey = 'kode_brand'| 'jenis' | 'jenis_etiket' | 'tipe' | 'nama_produk' | 'stok_aktual' | 'pemakaian_per_hari' | 'stok_level_pabrik' | 'stok_level_pabrik_wip_bj' | 'stok_level_pabrik_wip_bj_plan';
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
export default function StockLevelPabrikTab({ theme }: Props) {
  const t  = tk[theme];
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  const [rawRows, setRawRows]   = useState<StockLevelRawRow[]>([]);
  const [periodeAwal, setPeriodeAwal]   = useState('');
  const [periodeAkhir, setPeriodeAkhir] = useState('');
  const [loading, setLoading]   = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');
  const [jenisEtiketFilter, setJenisEtiketFilter] = useState<string>('ALL');
  const [tipeFilter, setTipeFilter] = useState<string>('ALL');

  const [sortKey, setSortKey] = useState<SortKey>('stok_level_pabrik');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<StockLevelComputedRow | null>(null);

  const { user } = useAuth();

  const visibleCols = useMemo(() => {
    if (!user?.role) return new Set(STOCK_LEVEL_COLUMNS.map(c => c.id));

    const roleDefault = STOCK_LEVEL_COLUMNS.filter(c => c.roles.includes(user.role as Role)).map(c => c.id);

    if (!Array.isArray(user.allowedMenus)) return new Set(roleDefault);

    const overrideCols = user.allowedMenus
      .filter(id => isStockColId(id))
      .map(id => stripStockColPrefix(id));

    return new Set(overrideCols.length > 0 ? overrideCols : roleDefault);
  }, [user]);

  const showCol = (id: string) => visibleCols.has(id);
  
  // State untuk hover tabel dengan kolom sticky
  // const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) {
        p.set('search', search);
      }
      const queryString = p.toString();
      const r: StockLevelApiResponse = await apiJson(
        `/api/stock-level-pabrik${queryString ? `?${queryString}` : ''}`
      );
      if (r.success) {
        setRawRows(r.data.rows ?? []);
        setPeriodeAwal(r.data.periode_awal ?? '');
        setPeriodeAkhir(r.data.periode_akhir ?? '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const computed = useMemo(() => rawRows.map(computeRow), [rawRows]);

  const JenisEtiketOptions = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach(r => { if (r.jenis_etiket) set.add(r.jenis_etiket)});
    return Array.from(set).sort();
  }, [rawRows]);

  const TipeOptions = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach(r => { if (r.tipe) set.add(r.tipe)});
    return Array.from(set).sort();
  }, [rawRows]);

  const JenisOptions = useMemo(() => {
    const set = new Set<string>();
    rawRows.forEach(r => { if (r.jenis) set.add(r.jenis); });
    return Array.from(set).sort();
  }, [rawRows]);

  const filtered = useMemo(() => {
    let result = computed;
    if (jenisFilter !== 'ALL') {
      result = result.filter(r => r.jenis === jenisFilter);
    }
    if (jenisEtiketFilter !== 'ALL') {
      result = result.filter(r => r.jenis_etiket === jenisEtiketFilter);
    }
    if (tipeFilter !== 'ALL') {
      result = result.filter(r => r.tipe === tipeFilter);
    }
    return result;
  }, [computed, jenisFilter, jenisEtiketFilter, tipeFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  // KPI
  const totalItem = filtered.length;
  const itemKritis  = filtered.filter(r => r.stok_level_pabrik !== null && r.stok_level_pabrik < STOCK_LEVEL_DANGER).length;
  const itemWarning = filtered.filter(r => r.stok_level_pabrik !== null && r.stok_level_pabrik >= STOCK_LEVEL_DANGER && r.stok_level_pabrik < STOCK_LEVEL_WARNING).length;
  const avgLevel = totalItem
    ? filtered.reduce((s, r) => s + (r.stok_level_pabrik ?? 0), 0) / totalItem
    : 0;

  const kpiCards = [
    { label: 'Total Item',      value: fmtNum(totalItem),        sub: 'produk', color: t.card2text, bg: t.card2bg, border: t.card2border },
    { label: 'Stok Kritis',     value: fmtNum(itemKritis),       sub: `< ${STOCK_LEVEL_DANGER} hari`, color: '#ef4444', bg: t.card4bg, border: t.card4border },
    { label: 'Perlu Perhatian', value: fmtNum(itemWarning),      sub: `${STOCK_LEVEL_DANGER}–${STOCK_LEVEL_WARNING} hari`, color: '#f59e0b', bg: t.card1bg, border: t.card1border },
    { label: 'Rata-rata Level', value: fmtDay(avgLevel),         sub: 'stok level pabrik', color: t.card2text, bg: t.card2bg, border: t.card2border },
  ];

  

  function levelColor(days: number | null): string {
    if (days === null) return t.textMuted;
    if (days < STOCK_LEVEL_DANGER) return '#ef4444';
    if (days < STOCK_LEVEL_WARNING) return '#f59e0b';
    return '#10b981';
  }

  function infoColor(info: number | null): string {
    if (info == null) return t.textMuted
    return '#f59e0b'
  }

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
        type="text" placeholder="Cari kode brand / pabrik / etiket…" value={searchInput}
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

  // FIlter Produk
  const JenisFilter = (
    <select
      value={jenisFilter}
      onChange={e => setJenisFilter(e.target.value)}
      style={{
        height: 28,
        padding: '0 28px 0 10px',
        borderRadius: 6,
        background: t.filterbg,
        border: `1px solid ${t.borderInput}`,
        color: t.text,
        outline: 'none',
        fontSize: 11,
        fontFamily: FONT_MONO,
        cursor: 'pointer',
      }}
    >
      <option value="ALL">Semua Jenis Produk</option>
      {JenisOptions.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );

  // Filter Jenis Etiket (Level 1: UV / Konven / -)
  const JenisEtiketFilter = (
  <select
    value={jenisEtiketFilter}
    onChange={e => setJenisEtiketFilter(e.target.value)}
    style={{
      height: 28,
      padding: '0 28px 0 10px',
      borderRadius: 6,
      background: t.filterbg,
      border: `1px solid ${t.borderInput}`,
      color: t.text,
      outline: 'none',
      fontSize: 11,
      fontFamily: FONT_MONO,
      cursor: 'pointer',
    }}
  >
    <option value="ALL">Semua Jenis Etiket</option>
    {JenisEtiketOptions.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

  // Filter Tipe (Level 2: Etiket / Inner / Dos / Slop Dos)
  const TipeFilter = (
  <select
    value={tipeFilter}
    onChange={e => setTipeFilter(e.target.value)}
    style={{
      height: 28,
      padding: '0 28px 0 10px',
      borderRadius: 6,
      background: t.filterbg,
      border: `1px solid ${t.borderInput}`,
      color: t.text,
      outline: 'none',
      fontSize: 11,
      fontFamily: FONT_MONO,
      cursor: 'pointer',
    }}
  >
    <option value="ALL">Semua Tipe</option>
    {TipeOptions.map(opt => (
      <option key={opt} value={opt}>{opt}</option>
    ))}
  </select>
);

  const Toolbar = isMobile || isTablet ? (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }} onClick={() => setFilterOpen(o => !o)}>
        <Filter size={12} color={t.textMuted} />
        <span style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, fontWeight: 600, flex: 1 }}>Filter</span>
        {filterOpen ? <ChevronUp size={13} color={t.textMuted} /> : <ChevronDown size={13} color={t.textMuted} />}
        <button onClick={e => { e.stopPropagation(); loadData(); }} style={{ height: 26, width: 26, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textSub }}>
          <RefreshCw size={11} />
        </button>
      </div>
      
      {filterOpen && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* {JenisFilter} */}
            {JenisEtiketFilter}
            {TipeFilter}
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
      {periodeAwal && periodeAkhir && (
        <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO, padding: '3px 8px', borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}` }}>
          {fmtDate(periodeAwal)} – {fmtDate(periodeAkhir)}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {/* {JenisFilter} */}
      {JenisEtiketFilter}
      {TipeFilter}
      {SearchBox}
      <button onClick={() => setSearch(searchInput)} style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: FONT_MONO }}>Cari</button>
      <button onClick={() => loadData()} style={{ height: 28, width: 28, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
        <RefreshCw size={12} />
      </button>
    </div>
  );

  const KpiRow = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 8 : 12 }}>
      {kpiCards.map(card => (
        <div key={card.label} style={{ borderRadius: 13, padding: isMobile ? '10px 12px' : '12px 14px', background: card.bg, border: `1px solid ${card.border}` }}>
          <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 5 }}>{card.label}</div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
          <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginTop: 4 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );

  // Konfigurasi Lebar & Posisi Kiri untuk kolom sticky
  const STICKY = {
    produk: { left: 0, width: 250 },
    // jenis:  { left: 190, width: 80 },
    etiket: { left: 250, width: 90 },
    tipe:   { left: 340, width: 90 },
  };

  const getStickyTh = (key: keyof typeof STICKY, isLast = false): React.CSSProperties => ({
    position: 'sticky',
    top: 0,
    left: STICKY[key].left,
    minWidth: STICKY[key].width,
    maxWidth: STICKY[key].width,
    zIndex: 2,
    background: t.tableHead,
    borderRight: isLast ? `2px solid ${t.borderInput}` : undefined,
  });

  const getStickyTd = (key: keyof typeof STICKY, bg: string, isLast = false): React.CSSProperties => ({
    position: 'sticky',
    left: STICKY[key].left,
    minWidth: STICKY[key].width,
    maxWidth: STICKY[key].width,
    zIndex: 1,
    borderRight: isLast ? `2px solid ${t.borderInput}` : undefined,
    background: bg,
    '--sticky-bg': bg, // Simpan warna solid sebagai variabel CSS
  } as React.CSSProperties);

  // Table (desktop/tablet)
  const DesktopTable = (
    <>
      {/* CSS Native untuk menangani hover pada tabel yang memiliki position: sticky */}
      <style>{`
        /* 1. Hover kolom normal */
        .hover-row:hover td:not(.sticky-col) {
          background-color: ${t.rowHover} !important;
        }

        /* 2. Hover kolom sticky */
        .hover-row:hover td.sticky-col {
          /* Kita gunakan teknik 'overlay' dengan warna solid. 
             Kita campurkan rowHover dengan warna cardbg/tableAlt 
             untuk menghilangkan transparansi alpha yang menyebabkan overlap */
          background-color: ${t.tableHead} !important;
          background-image: linear-gradient(to right, ${t.rowHover}, ${t.rowHover}) !important;
        }
      `}</style>

      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
        <thead>
          <tr>
            {/* header */}
            {showCol('produk') && (
              <th style={{ ...thS, ...getStickyTh('produk') }} onClick={() => toggleSort('nama_produk')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  Produk <SortIcon k="nama_produk" />
                </span>
              </th>
            )}
            {showCol('jenis_etiket') && (
              <th style={{ ...thS, ...getStickyTh('etiket') }} onClick={() => toggleSort('jenis_etiket')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  Jenis Etiket<SortIcon k="jenis_etiket" />
                </span>
              </th>
            )}
            {showCol('tipe') && (
              <th style={{ ...thS, ...getStickyTh('tipe', true) }} onClick={() => toggleSort('tipe')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  Tipe<SortIcon k="tipe" />
                </span>
              </th>
            )}
            {showCol('stok_pabrik') && (
              <th style={{ ...thS, textAlign: 'right' }}>Stok Pabrik{periodeAwal ? ` ${fmtDate(periodeAwal)}` : ''}</th>
            )}
            {showCol('pengiriman') && <th style={{ ...thS, textAlign: 'right' }}>Pengiriman SSS</th>}
            {showCol('estimasi_kebutuhan') && <th style={{ ...thS, textAlign: 'right' }}>Estimasi Kebutuhan</th>}
            {showCol('estimasi_stok') && (
              <th style={{ ...thS, textAlign: 'right' }}>Estimasi Stok{periodeAkhir ? ` ${fmtDate(periodeAkhir)}` : ''}</th>
            )}
            {showCol('stok_aktual') && (
              <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('stok_aktual')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Stok Aktual <SortIcon k="stok_aktual" />
                </span>
              </th>
            )}
            {!isTablet && showCol('pemakaian_bulan') && <th style={{ ...thS, textAlign: 'right' }}>Pemakaian/Bulan</th>}
            {!isTablet && showCol('pemakaian_minggu') && <th style={{ ...thS, textAlign: 'right' }}>Pemakaian/Minggu</th>}
            {showCol('pemakaian_hari') && (
              <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('pemakaian_per_hari')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Pemakaian/Hari <SortIcon k="pemakaian_per_hari" />
                </span>
              </th>
            )}
            {showCol('level_pabrik') && (
              <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('stok_level_pabrik')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Stock Level Pabrik <SortIcon k="stok_level_pabrik" />
                </span>
              </th>
            )}
            {showCol('level_wip_bj') && (
              <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('stok_level_pabrik_wip_bj')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Stock Level +WIP+BJ <SortIcon k="stok_level_pabrik_wip_bj" />
                </span>
              </th>
            )}
            {!isTablet && showCol('level_wip_bj_plan') && (
              <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('stok_level_pabrik_wip_bj_plan')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Stock Level +WIP+BJ+Plan <SortIcon k="stok_level_pabrik_wip_bj_plan" />
                </span>
              </th>
            )}
            {showCol('up') && <th style={{ ...thS, textAlign: 'right' }}>Up</th>}
            {!isTablet && showCol('wip') && <th style={{ ...thS, textAlign: 'right' }}>WIP</th>}
            {!isTablet && showCol('bj') && <th style={{ ...thS, textAlign: 'right' }}>BJ</th>}
            {!isTablet && showCol('kiriman') && <th style={{ ...thS, textAlign: 'right' }}>Kiriman</th>}
            {!isTablet && showCol('plan_produksi') && <th style={{ ...thS, textAlign: 'right' }}>Plan Produksi</th>}
            {!isTablet && showCol('keterangan') && <th style={thS}>Keterangan</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isAlt = i % 2 === 1;
            const rowBg = isAlt ? t.tableAlt : 'transparent';
            
            // Kolom sticky tidak boleh 'transparent' agar data yang di-scroll tidak tembus pandang
            const stickyBg = isAlt ? t.tableAlt : t.cardbg; 

            return (
              <tr key={row.id} className="hover-row" style={{ background: rowBg }}>
                {/* body — per row, urutan sel HARUS sama dengan urutan header di atas */}
                {showCol('produk') && <td className="sticky-col" style={{ ...tdS, ...getStickyTd('produk', stickyBg), color: t.text }}>{row.nama_produk}</td>}
                {showCol('jenis_etiket') && <td className="sticky-col" style={{ ...tdS, ...getStickyTd('etiket', stickyBg), color: t.text }}>{row.jenis_etiket ?? '—'}</td>}
                {showCol('tipe') && <td className="sticky-col" style={{ ...tdS, ...getStickyTd('tipe', stickyBg, true), color: t.text }}>{row.tipe ?? '—'}</td>}
                {showCol('stok_pabrik') && <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: t.infoText }}>{fmtNum(row.stok_pabrik)}</td>}
                {showCol('pengiriman') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.pengiriman)}</td>}
                {showCol('estimasi_kebutuhan') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.estimasi_kebutuhan)}</td>}
                {showCol('estimasi_stok') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.estimasi_stok)}</td>}
                {showCol('stok_aktual') && <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: t.infoText }}>{fmtNum(row.stok_aktual)}</td>}
                {!isTablet && showCol('pemakaian_bulan') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.pemakaian_per_bulan)}</td>}
                {!isTablet && showCol('pemakaian_minggu') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.pemakaian_per_minggu, 1)}</td>}
                {showCol('pemakaian_hari') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{fmtNum(row.pemakaian_per_hari, 2)}</td>}
                {showCol('level_pabrik') && <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: levelColor(row.stok_level_pabrik) }}>{fmtDay(row.stok_level_pabrik)}</td>}
                {showCol('level_wip_bj') && <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: levelColor(row.stok_level_pabrik_wip_bj) }}>{fmtDay(row.stok_level_pabrik_wip_bj)}</td>}
                {!isTablet && showCol('level_wip_bj_plan') && <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: levelColor(row.stok_level_pabrik_wip_bj_plan) }}>{fmtDay(row.stok_level_pabrik_wip_bj_plan)}</td>}
                {showCol('up') && <td style={{ ...tdS, textAlign: 'right', color: t.text }}>{row.up ?? '—'}</td>}
                {!isTablet && showCol('wip') && <td style={{ ...tdS, textAlign: 'right', color: infoColor(row.wip) }}>{fmtNum(row.wip)}</td>}
                {!isTablet && showCol('bj') && <td style={{ ...tdS, textAlign: 'right', color: infoColor(row.bj) }}>{fmtNum(row.bj)}</td>}
                {!isTablet && showCol('kiriman') && <td style={{ ...tdS, textAlign: 'right', color: infoColor(row.kiriman) }}>{fmtNum(row.kiriman)}</td>}
                {!isTablet && showCol('plan_produksi') && <td style={{ ...tdS, textAlign: 'right', color: infoColor(row.plan_produksi) }}>{fmtNum(row.plan_produksi)}</td>}
                {!isTablet && showCol('keterangan') && <td style={{ ...tdS, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: t.text }}>{row.keterangan || '—'}</td>}
              </tr>
            );
          })}
        </tbody>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{row.kode_brand}</span>
            <span style={{ fontSize: 11, background: t.inputBg, border: `1px solid ${t.border}`, padding: '2px 6px', borderRadius: 4, color: t.text, fontFamily: FONT_MONO }}>
              {row.jenis_etiket} | {row.tipe}
            </span>
            <span style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO }}>{row.kode_pabrik}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
            {row.nama_produk}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>STOK AKTUAL</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, fontFamily: FONT_MONO }}>{fmtNum(row.stok_aktual)}</span>
            </div>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>PEMAKAIAN/HARI</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textSub, fontFamily: FONT_MONO }}>{fmtNum(row.pemakaian_per_hari, 2)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1, padding: '4px 6px', borderRadius: 6, background: t.inputBg }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>LEVEL PABRIK</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: levelColor(row.stok_level_pabrik), fontFamily: FONT_MONO }}>{fmtDay(row.stok_level_pabrik)}</span>
            </div>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1, padding: '4px 6px', borderRadius: 6, background: t.inputBg }}>
              <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO }}>Stock Level +WIP+BJ</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: levelColor(row.stok_level_pabrik_wip_bj), fontFamily: FONT_MONO }}>{fmtDay(row.stok_level_pabrik_wip_bj)}</span>
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
          padding: '14px 16px 24px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.text, fontFamily: FONT_MONO }}>{selectedRow.kode_brand}</div>
            <div style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, marginTop: 2 }}>{selectedRow.nama_produk}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, background: t.inputBg, border: `1px solid ${t.border}`, padding: '2px 8px', borderRadius: 4, color: t.text, fontFamily: FONT_MONO }}>
              {selectedRow.jenis_etiket ?? '—'} | {selectedRow.tipe ?? '—'}
            </span>
            <span style={{ fontSize: 11, background: t.inputBg, border: `1px solid ${t.border}`, padding: '2px 8px', borderRadius: 4, color: t.text, fontFamily: FONT_MONO }}>
              {selectedRow.kode_pabrik}
            </span>
          </div>
          <button
            onClick={() => setSelectedRow(null)}
            style={{ background: t.inputBg, border: `1px solid ${t.borderInput}`, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted, flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Highlight level stok */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: t.inputBg, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginBottom: 2 }}>LEVEL PABRIK</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: levelColor(selectedRow.stok_level_pabrik), fontFamily: FONT_MONO }}>{fmtDay(selectedRow.stok_level_pabrik)}</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: t.inputBg, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginBottom: 2 }}>+WIP+BJ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: levelColor(selectedRow.stok_level_pabrik_wip_bj), fontFamily: FONT_MONO }}>{fmtDay(selectedRow.stok_level_pabrik_wip_bj)}</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: t.inputBg, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: t.text, fontFamily: FONT_MONO, marginBottom: 2 }}>+WIP+BJ+Plan</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: levelColor(selectedRow.stok_level_pabrik_wip_bj_plan), fontFamily: FONT_MONO }}>{fmtDay(selectedRow.stok_level_pabrik_wip_bj_plan)}</div>
          </div>
        </div>

        {/* Detail lengkap, sama seperti kolom tabel desktop */}
        {showCol('stok_pabrik') && detailRow(`Stok Pabrik${periodeAwal ? ` (${fmtDate(periodeAwal)})` : ''}`, fmtNum(selectedRow.stok_pabrik), t.infoText)}
        {showCol('pengiriman') && detailRow('Pengiriman SSS', fmtNum(selectedRow.pengiriman))}
        {showCol('estimasi_kebutuhan') && detailRow('Estimasi Kebutuhan', fmtNum(selectedRow.estimasi_kebutuhan))}
        {showCol('estimasi_stok') && detailRow(`Estimasi Stok${periodeAkhir ? ` (${fmtDate(periodeAkhir)})` : ''}`, fmtNum(selectedRow.estimasi_stok))}
        {showCol('stok_aktual') && detailRow(`Stok Aktual${periodeAkhir ? ` (${fmtDate(periodeAkhir)})` : ''}`, fmtNum(selectedRow.stok_aktual), t.infoText)}
        {showCol('pemakaian_per_bulan') && detailRow('Pemakaian/Bulan', fmtNum(selectedRow.pemakaian_per_bulan))}
        {showCol('pemakaian_per_minggu') && detailRow('Pemakaian/Minggu', fmtNum(selectedRow.pemakaian_per_minggu, 1))}
        {showCol('pemakaian_per_hari') && detailRow('Pemakaian/Hari', fmtNum(selectedRow.pemakaian_per_hari, 2))}
        {showCol('up') && detailRow('UP', selectedRow.up ?? '—')}
        {showCol('wip') && detailRow('WIP', fmtNum(selectedRow.wip))}
        {showCol('bj') && detailRow('BJ', fmtNum(selectedRow.bj))}
        {showCol('kiriman') && detailRow('Kiriman', fmtNum(selectedRow.kiriman))}
        {showCol('plan_produksi') && detailRow('Plan Produksi', fmtNum(selectedRow.plan_produksi))}

        <div style={{ paddingTop: 10, paddingBottom: 50 }}>
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO, marginBottom: 3 }}>Keterangan</div>
          <div style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO }}>{selectedRow.keterangan || '—'}</div>
        </div>
      </div>
    </div>
  );

  const TableCard = (
  <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden' }}>
    {/* Header Section */}
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>
          Stock Level - {fmtDate(periodeAwal)} s/d {fmtDate(periodeAkhir)}
        </div>
      </div>
    </div>
    
    {/* Body Section */}
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '80vh',  WebkitOverflowScrolling: 'touch' }}>
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