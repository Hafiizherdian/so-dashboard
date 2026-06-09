'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  ClipboardCheck, Search, Filter, RefreshCw,
  TrendingUp, AlertCircle, CheckCircle, X, ChevronUp, ChevronDown,
} from 'lucide-react';
import { Theme, tk, FONT_MONO, CC } from '@/lib/theme';
import { apiJson } from '@/lib/apiFetch';

interface Props { theme: Theme; }

interface LhkpSummary {
  total_records: number;
  total_plan:    number;
  total_baik:    number;
  total_rusak:   number;
  yield_pct:     number;
}
interface ByGroup { proses?: string; mesin?: string; week?: string; qty_baik: number; qty_rusak: number; records: number; }
interface DetailRow {
  id: string; tanggal: string; week: string; mesin: string; proses: string;
  no_job_order: string; no_lhkp: string; output_produk: string;
  qty_plan: number; qty_baik: number; qty_rusak: number; unit: string;
}
interface UploadRow { id: string; file_name: string; record_count: number; tgl_awal: string; tgl_akhir: string; created_at: string; }
interface FilterOpts { weeks: string[]; bulans: string[]; mesin: string[]; proses: string[]; }

const EMPTY_SUMMARY: LhkpSummary = { total_records: 0, total_plan: 0, total_baik: 0, total_rusak: 0, yield_pct: 0 };

function fmtNum(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return n.toLocaleString('id-ID');
}
function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}-${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

type SortKey = 'tanggal' | 'mesin' | 'proses' | 'qty_baik' | 'qty_rusak' | 'qty_plan';
type SortDir = 'asc' | 'desc';

// ── Breakpoint hook ──
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

export default function LhkpTab({ theme }: Props) {
  const t  = tk[theme];
  const bp = useBreakpoint();

  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  const [uploads,        setUploads]        = useState<UploadRow[]>([]);
  const [filterOpts,     setFilterOpts]     = useState<FilterOpts>({ weeks: [], bulans: [], mesin: [], proses: [] });
  const [summary,        setSummary]        = useState<LhkpSummary>(EMPTY_SUMMARY);
  const [byProses,       setByProses]       = useState<ByGroup[]>([]);
  const [byMesin,        setByMesin]        = useState<ByGroup[]>([]);
  const [byWeek,         setByWeek]         = useState<ByGroup[]>([]);
  const [detail,         setDetail]         = useState<DetailRow[]>([]);
  const [loading,        setLoading]        = useState(true);

  const [selectedUpload, setSelectedUpload] = useState('');
  const [filterWeek,     setFilterWeek]     = useState('all');
  const [filterMesin,    setFilterMesin]    = useState('all');
  const [filterProses,   setFilterProses]   = useState('all');
  const [filterBulan,    setFilterBulan]    = useState('all');
  const [search,         setSearch]         = useState('');
  const [searchInput,    setSearchInput]    = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('tanggal');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [chartMode, setChartMode] = useState<'proses' | 'mesin' | 'week'>('proses');

  // Mobile: filter panel collapsible
  const [filterOpen, setFilterOpen] = useState(false);

  const loadUploads = async () => {
    const r = await apiJson('/api/lhkp?list=1');
    if (r.success) setUploads(r.data ?? []);
  };

  const loadFilterOpts = async (uploadId?: string) => {
    const p = new URLSearchParams({ filters: '1' });
    if (uploadId) p.set('upload_id', uploadId);
    const r = await apiJson(`/api/lhkp?${p}`);
    if (r.success) setFilterOpts(r.data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (selectedUpload)         p.set('upload_id', selectedUpload);
      if (filterWeek   !== 'all') p.set('week',   filterWeek);
      if (filterBulan  !== 'all') p.set('bulan',  filterBulan);
      if (filterMesin  !== 'all') p.set('mesin',  filterMesin);
      if (filterProses !== 'all') p.set('proses', filterProses);
      if (search)                 p.set('search', search);
      const r = await apiJson(`/api/lhkp?${p}`);
      if (r.success) {
        setSummary(r.data.summary);
        setByProses(r.data.byProses);
        setByMesin(r.data.byMesin);
        setByWeek(r.data.byWeek);
        setDetail(r.data.detail);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUploads().then(() => loadData()); }, []);
  useEffect(() => { loadData(); }, [selectedUpload, filterWeek, filterMesin, filterProses, filterBulan, search]);
  useEffect(() => { loadFilterOpts(selectedUpload || undefined); }, [selectedUpload]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const sortedDetail = useMemo(() => {
    return [...detail].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [detail, sortKey, sortDir]);

  const yieldColor = summary.yield_pct >= 98 ? '#10b981' : summary.yield_pct >= 90 ? '#f59e0b' : '#ef4444';

  const chartData = chartMode === 'proses' ? byProses.slice(0,10).map(r => ({ label: r.proses!, ...r }))
    : chartMode === 'mesin' ? byMesin.slice(0,10).map(r => ({ label: r.mesin!, ...r }))
    : byWeek.map(r => ({ label: r.week!, ...r }));

  const thS: React.CSSProperties = {
    padding: '7px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: t.textMuted, borderBottom: `1px solid ${t.border}`,
    fontFamily: FONT_MONO, background: t.tableHead, whiteSpace: 'nowrap', cursor: 'pointer',
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
  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp size={9} color="#6366f1"/> : <ChevronDown size={9} color="#6366f1"/>)
    : <ChevronUp size={9} color={t.textFaint}/>;

  // ── Active filter count (for mobile badge) ──
  const activeFilters = [filterWeek, filterBulan, filterMesin, filterProses].filter(f => f !== 'all').length
    + (selectedUpload ? 1 : 0)
    + (search ? 1 : 0);

  // ── KPI cards data ──
  const kpiCards = [
    { label: 'Total Plan',  value: fmtNum(summary.total_plan),         sub: 'qty direncanakan', color: t.card2text, bg: t.card2bg, border: t.card2border },
    { label: 'Qty Baik',    value: fmtNum(summary.total_baik),         sub: 'output good',      color: '#10b981',  bg: t.card2bg, border: t.card2border },
    { label: 'Qty Rusak',   value: fmtNum(summary.total_rusak),        sub: 'output reject',    color: t.card4text, bg: t.card4bg, border: t.card4border },
    { label: 'Yield Rate',  value: `${summary.yield_pct.toFixed(2)}%`, sub: 'baik / (baik+rusak)', color: yieldColor, bg: t.card1bg, border: t.card1border },
  ];

  // ══════════════════════════════════════════════════════════
  // TOOLBAR — desktop vs mobile/tablet differ
  // ══════════════════════════════════════════════════════════

  const ToolbarDesktop = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, padding: '10px 14px' }}>
      <Filter size={11} color={t.textMuted}/>
      <span style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT_MONO }}>Filter</span>

      <select style={{ ...selS, minWidth: 200 }} value={selectedUpload} onChange={e => { setSelectedUpload(e.target.value); setFilterWeek('all'); setFilterMesin('all'); setFilterProses('all'); setFilterBulan('all'); }}>
        <option value="">{uploads.length ? 'Terbaru' : '— Belum ada upload —'}</option>
        {uploads.map(u => (
          <option key={u.id} value={u.id}>
            {fmtDate(u.tgl_awal)}–{fmtDate(u.tgl_akhir)} ({u.record_count.toLocaleString('id-ID')} rec)
          </option>
        ))}
      </select>

      <select style={selS} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
        <option value="all">Semua Minggu</option>
        {filterOpts.weeks.slice().sort((a,b) => parseInt(a.match(/\d+/)?.[0]||'0') - parseInt(b.match(/\d+/)?.[0]||'0')).map(w => <option key={w} value={w}>{w}</option>)}
      </select>
      <select style={selS} value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
        <option value="all">Semua Bulan</option>
        {filterOpts.bulans.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <select style={{ ...selS, minWidth: 130 }} value={filterMesin} onChange={e => setFilterMesin(e.target.value)}>
        <option value="all">Semua Mesin</option>
        {filterOpts.mesin.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select style={{ ...selS, minWidth: 120 }} value={filterProses} onChange={e => setFilterProses(e.target.value)}>
        <option value="all">Semua Proses</option>
        {filterOpts.proses.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <div style={{ flex: 1 }}/>

      <div style={{ position: 'relative' }}>
        <Search size={11} color={t.textMuted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}/>
        <input
          type="text" placeholder="Cari produk / JOP…" value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
          style={{ height: 28, paddingLeft: 26, paddingRight: 28, fontSize: 11, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text, outline: 'none', width: 180, fontFamily: FONT_MONO }}
        />
        {searchInput && (
          <button onClick={() => { setSearchInput(''); setSearch(''); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 0 }}>
            <X size={10}/>
          </button>
        )}
      </div>
      <button onClick={() => setSearch(searchInput)} style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: FONT_MONO }}>Cari</button>
      <button onClick={() => { loadUploads(); loadData(); }} style={{ height: 28, width: 28, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
        <RefreshCw size={12}/>
      </button>
    </div>
  );

  // Mobile/tablet toolbar: collapsed by default, toggle to expand
  const ToolbarMobile = (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Toggle row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setFilterOpen(o => !o)}
      >
        <Filter size={12} color={t.textMuted}/>
        <span style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, fontWeight: 600, flex: 1 }}>
          Filter
          {activeFilters > 0 && (
            <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 700 }}>
              {activeFilters}
            </span>
          )}
        </span>
        {filterOpen ? <ChevronUp size={13} color={t.textMuted}/> : <ChevronDown size={13} color={t.textMuted}/>}
        <button onClick={e => { e.stopPropagation(); loadUploads(); loadData(); }} style={{ height: 26, width: 26, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.textMuted }}>
          <RefreshCw size={11}/>
        </button>
      </div>

      {/* Collapsible filter panel */}
      {filterOpen && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Upload selector full width */}
          <select style={{ ...selS, width: '100%' }} value={selectedUpload} onChange={e => { setSelectedUpload(e.target.value); setFilterWeek('all'); setFilterMesin('all'); setFilterProses('all'); setFilterBulan('all'); }}>
            <option value="">{uploads.length ? 'Terbaru' : '— Belum ada upload —'}</option>
            {uploads.map(u => (
              <option key={u.id} value={u.id}>
                {fmtDate(u.tgl_awal)}–{fmtDate(u.tgl_akhir)} ({u.record_count.toLocaleString('id-ID')} rec)
              </option>
            ))}
          </select>

          {/* 2-col filter grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <select style={{ ...selS, width: '100%' }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
              <option value="all">Semua Minggu</option>
              {filterOpts.weeks.slice().sort((a,b) => parseInt(a.match(/\d+/)?.[0]||'0') - parseInt(b.match(/\d+/)?.[0]||'0')).map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select style={{ ...selS, width: '100%' }} value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
              <option value="all">Semua Bulan</option>
              {filterOpts.bulans.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select style={{ ...selS, width: '100%' }} value={filterMesin} onChange={e => setFilterMesin(e.target.value)}>
              <option value="all">Semua Mesin</option>
              {filterOpts.mesin.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select style={{ ...selS, width: '100%' }} value={filterProses} onChange={e => setFilterProses(e.target.value)}>
              <option value="all">Semua Proses</option>
              {filterOpts.proses.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Search row */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={11} color={t.textMuted} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}/>
              <input
                type="text" placeholder="Cari produk / JOP…" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
                style={{ height: 28, width: '100%', boxSizing: 'border-box', paddingLeft: 26, paddingRight: searchInput ? 28 : 8, fontSize: 11, borderRadius: 6, background: t.inputBg, border: `1px solid ${t.borderInput}`, color: t.text, outline: 'none', fontFamily: FONT_MONO }}
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch(''); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 0 }}>
                  <X size={10}/>
                </button>
              )}
            </div>
            <button onClick={() => setSearch(searchInput)} style={{ height: 28, padding: '0 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: FONT_MONO, flexShrink: 0 }}>Cari</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── KPI Row ──
  const KpiRow = (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 8 : 12 }}>
      {kpiCards.map(card => (
        <div key={card.label} style={{ borderRadius: 13, padding: isMobile ? '10px 12px' : '12px 14px', background: card.bg, border: `1px solid ${card.border}` }}>
          <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 5 }}>{card.label}</div>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
          <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 4 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );

  // ── Chart ──
  const ChartNode = (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardCheck size={11} color="#818cf8"/>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Qty Baik &amp; Rusak</span>
        </div>
        <div style={{ display: 'flex', gap: 4, background: t.inputBg, borderRadius: 7, padding: 3, flexShrink: 0 }}>
          {(['proses','mesin','week'] as const).map(m => (
            <button key={m} onClick={() => setChartMode(m)} style={{ fontSize: isMobile ? 8 : 9, padding: isMobile ? '2px 7px' : '3px 10px', borderRadius: 5, border: 'none', fontFamily: FONT_MONO, cursor: 'pointer', background: chartMode === m ? t.cardbg : 'transparent', color: chartMode === m ? t.text : t.textMuted, fontWeight: chartMode === m ? 700 : 400, boxShadow: chartMode === m ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>
              {m === 'proses' ? (isMobile ? 'Proses' : 'Per Proses') : m === 'mesin' ? (isMobile ? 'Mesin' : 'Per Mesin') : (isMobile ? 'Minggu' : 'Per Minggu')}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
        <BarChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.gridStroke} vertical={false}/>
          <XAxis
            dataKey="label"
            tick={{ fontSize: isMobile ? 8 : 9, fill: t.textMuted, fontFamily: FONT_MONO }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v.length > (isMobile ? 8 : 14) ? v.slice(0, isMobile ? 8 : 14) + '…' : v}
          />
          <YAxis tickFormatter={fmtNum} tick={{ fontSize: isMobile ? 8 : 9, fill: t.textMuted, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={isMobile ? 36 : 44}/>
          <Tooltip
            contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 8, fontSize: 11, fontFamily: FONT_MONO }}
            formatter={(v: any) => v.toLocaleString('id-ID')}
          />
          <Bar dataKey="qty_baik"  name="Qty Baik"  fill="#10b981" opacity={0.85} radius={[3,3,0,0]} maxBarSize={28}/>
          <Bar dataKey="qty_rusak" name="Qty Rusak" fill="#ef4444" opacity={0.75} radius={[3,3,0,0]} maxBarSize={28}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // ── Detail Table ──
  // Mobile: hanya tampilkan kolom penting — Tanggal, Proses, Output Produk, Qty Baik, Rusak
  // Tablet: tampilkan semua kecuali No LHKP
  const DetailTable = (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardCheck size={12} color="#818cf8"/>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Detail LHKP</div>
          <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{sortedDetail.length} records {sortedDetail.length >= 500 ? '(maks 500 tampil)' : ''}</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 11 }}>Memuat data…</div>
        ) : sortedDetail.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>Tidak ada data</div>
        ) : isMobile ? (
          // ── Mobile: card list instead of wide table ──
          <div style={{ padding: '4px 0' }}>
            {sortedDetail.map((row, i) => {
              const isFinish = row.proses === '-- FINISH --';
              const hasRusak = row.qty_rusak > 0;
              return (
                <div key={row.id} style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: i % 2 === 1 ? t.tableAlt : 'transparent' }}>
                  {/* Row 1: tanggal + week + proses badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO }}>{fmtDate(row.tanggal)}</span>
                      <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{row.week}</span>
                    </div>
                    {isFinish ? (
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: t.posBg, color: t.posText, border: `1px solid ${t.posBorder}` }}>FINISH</span>
                    ) : (
                      <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: t.infoBg, color: t.infoText, border: `1px solid ${t.infoBorder}` }}>{row.proses}</span>
                    )}
                  </div>
                  {/* Row 2: produk + mesin */}
                  <div style={{ fontSize: 11, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{row.output_produk}</div>
                  <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, marginBottom: 5 }}>{row.mesin} · JOP: {row.no_job_order}</div>
                  {/* Row 3: qty pills */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>PLAN</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, fontFamily: FONT_MONO }}>{row.qty_plan > 0 ? row.qty_plan.toLocaleString('id-ID') : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>BAIK</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: row.qty_baik > 0 ? '#10b981' : t.textMuted, fontFamily: FONT_MONO }}>{row.qty_baik > 0 ? row.qty_baik.toLocaleString('id-ID') : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>RUSAK</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: hasRusak ? t.negText : t.textMuted, fontFamily: FONT_MONO }}>{hasRusak ? row.qty_rusak.toLocaleString('id-ID') : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>UNIT</span>
                      <span style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO }}>{row.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── Tablet/Desktop: table ──
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={thS} onClick={() => toggleSort('tanggal')}><span style={{ display:'inline-flex',alignItems:'center',gap:3 }}>Tanggal <SortIcon k="tanggal"/></span></th>
                <th style={thS}>Week</th>
                <th style={thS} onClick={() => toggleSort('mesin')}><span style={{ display:'inline-flex',alignItems:'center',gap:3 }}>Mesin <SortIcon k="mesin"/></span></th>
                <th style={thS} onClick={() => toggleSort('proses')}><span style={{ display:'inline-flex',alignItems:'center',gap:3 }}>Proses <SortIcon k="proses"/></span></th>
                <th style={thS}>No JOP</th>
                {/* Sembunyikan No LHKP di tablet */}
                {!isTablet && <th style={thS}>No LHKP</th>}
                <th style={{ ...thS, minWidth: isTablet ? 140 : 180 }}>Output Produk</th>
                <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('qty_plan')}><span style={{ display:'inline-flex',alignItems:'center',gap:3,float:'right' }}>Qty Plan <SortIcon k="qty_plan"/></span></th>
                <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('qty_baik')}><span style={{ display:'inline-flex',alignItems:'center',gap:3,float:'right' }}>Qty Baik <SortIcon k="qty_baik"/></span></th>
                <th style={{ ...thS, textAlign: 'right' }} onClick={() => toggleSort('qty_rusak')}><span style={{ display:'inline-flex',alignItems:'center',gap:3,float:'right' }}>Rusak <SortIcon k="qty_rusak"/></span></th>
                <th style={thS}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {sortedDetail.map((row, i) => {
                const isFinish = row.proses === '-- FINISH --';
                const hasRusak = row.qty_rusak > 0;
                return (
                  <tr key={row.id}
                    style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                  >
                    <td style={{ ...tdS, color: t.textSub }}>{fmtDate(row.tanggal)}</td>
                    <td style={{ ...tdS, color: t.textMuted, fontSize: 10 }}>{row.week}</td>
                    <td style={{ ...tdS, color: t.textSub, maxWidth: isTablet ? 90 : 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.mesin}</td>
                    <td style={{ ...tdS }}>
                      {isFinish ? (
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: t.posBg, color: t.posText, border: `1px solid ${t.posBorder}` }}>FINISH</span>
                      ) : (
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, fontFamily: FONT_MONO, background: t.infoBg, color: t.infoText, border: `1px solid ${t.infoBorder}` }}>{row.proses}</span>
                      )}
                    </td>
                    <td style={{ ...tdS, color: t.textMuted, fontSize: 10 }}>{row.no_job_order}</td>
                    {!isTablet && <td style={{ ...tdS, color: t.textMuted, fontSize: 10 }}>{row.no_lhkp}</td>}
                    <td style={{ ...tdS, color: t.text, maxWidth: isTablet ? 160 : 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.output_produk}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: t.textMuted }}>{row.qty_plan > 0 ? row.qty_plan.toLocaleString('id-ID') : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: row.qty_baik > 0 ? '#10b981' : t.textMuted }}>{row.qty_baik > 0 ? row.qty_baik.toLocaleString('id-ID') : '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontWeight: hasRusak ? 700 : 400, color: hasRusak ? t.negText : t.textMuted }}>{hasRusak ? row.qty_rusak.toLocaleString('id-ID') : '—'}</td>
                    <td style={{ ...tdS, color: t.textMuted, fontSize: 10 }}>{row.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      {isMobile || isTablet ? ToolbarMobile : ToolbarDesktop}
      {KpiRow}
      {ChartNode}
      {DetailTable}
    </div>
  );
}