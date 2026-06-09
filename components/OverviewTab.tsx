'use client';
import React, { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, BarChart, Bar,
} from 'recharts';
import { TrendingUp, ShoppingCart, Receipt, AlertCircle, Users, Package, Tag } from 'lucide-react';
import { Theme, tk, CC, fmtRp, fmtRpFull, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { KpiCard, Card, ChartTooltip, ProgressBar } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; availH: number; }

const YEAR_BAR_COLORS: { bar: string; border: string }[] = [
  { bar: '#94a3b8', border: '#64748b' },
  { bar: '#6366f1', border: '#4f46e5' },
  { bar: '#10b981', border: '#059669' },
  { bar: '#f59e0b', border: '#d97706' },
  { bar: '#ec4899', border: '#db2777' },
];
const SO_BAR_COLORS:  { bar: string; border: string }[] = [
  { bar: '#94a3b855', border: '#64748b' },
  { bar: '#6366f155', border: '#4f46e5' },
  { bar: '#10b98155', border: '#059669' },
  { bar: '#f59e0b55', border: '#d97706' },
  { bar: '#ec489955', border: '#db2777' },
];
const OUT_BAR_COLORS: { bar: string; border: string }[] = [
  { bar: '#fca5a8aa', border: '#ef4444' },
  { bar: '#fbbf24aa', border: '#f59e0b' },
  { bar: '#f9a8d4aa', border: '#ec4899' },
  { bar: '#a78bdaaa', border: '#8b5cf6' },
  { bar: '#6ee7b7aa', border: '#10b981' },
];

type ChartMode = 'penj' | 'so';

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

export default function OverviewTab({ data, theme, availH }: Props) {
  const t  = tk[theme];
  const gs = t.gridStroke;
  const GAP = 8;
  const bp  = useBreakpoint();

  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isDesktop = bp === 'desktop';

  const [chartMode, setChartMode] = useState<ChartMode>('penj');

  const raw = (data ?? {}) as Partial<DashboardData>;

  const summary = {
    total_penjualan:   Number(raw.summary?.total_penjualan   ?? 0),
    total_so:          Number(raw.summary?.total_so          ?? 0),
    total_outstanding: Number(raw.summary?.total_outstanding ?? 0),
    qty_penjualan:     Number(raw.summary?.qty_penjualan     ?? 0),
    qty_so:            Number(raw.summary?.qty_so            ?? 0),
    transaksi:         Number(raw.summary?.transaksi         ?? 0),
    pct_outstanding:   Number(raw.summary?.pct_outstanding   ?? 0),
  };

  const monthly               = Array.isArray(raw.monthly)               ? raw.monthly               : [];
  const allYears: number[]    = Array.isArray((raw as any).allYears)     ? (raw as any).allYears     : [];
  const categories            = Array.isArray(raw.categories)            ? raw.categories            : [];
  const topCustomers          = Array.isArray(raw.topCustomers)          ? raw.topCustomers          : [];
  const typeCustomerBreakdown = Array.isArray(raw.typeCustomerBreakdown) ? raw.typeCustomerBreakdown : [];
  const keteranganBreakdown   = Array.isArray(raw.keteranganBreakdown)   ? raw.keteranganBreakdown   : [];

  const hasData = summary.transaksi > 0;

  if (!hasData) return (
    <div style={{ height: availH, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: t.inputBg, border: `1px solid ${t.borderCard}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TrendingUp size={22} color={t.textMuted} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: FONT_MONO, marginBottom: 4 }}>Belum ada data</div>
        <div style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO }}>Upload file Excel untuk mulai, lalu terapkan filter</div>
      </div>
    </div>
  );

  // ── Responsive height logic ──
  // Desktop: fixed layout with availH
  // Tablet/Mobile: scroll, ignore availH
  const CHART_H_DESKTOP = 120;
  const CHART_H_TABLET  = 140;
  const CHART_H_MOBILE  = 160;
  const chartH = isMobile ? CHART_H_MOBILE : isTablet ? CHART_H_TABLET : Math.max(80, availH - 380);

  const outstandingPct = summary.pct_outstanding;
  const outColor = outstandingPct > 50 ? '#ef4444' : outstandingPct > 25 ? '#f59e0b' : '#10b981';

  const totalTcPenjualan = typeCustomerBreakdown.reduce((s, r) => s + Number(r.penjualan ?? 0), 0) || 1;
  const tcData = typeCustomerBreakdown.slice(0, 6).map((r, i) => {
    const penjualan = Number(r.penjualan ?? 0);
    const pct = Number(r.pct ?? 0) > 0 ? Number(r.pct) : (penjualan / totalTcPenjualan) * 100;
    return { name: r.type_customer ?? '—', value: penjualan, pct, fill: CC[i % CC.length] };
  });

  const totalCatPenjualan = categories.reduce((s, r) => s + Number(r.total_penjualan ?? 0), 0) || 1;
  const categoriesWithPct = categories.slice(0, 8).map((c, i) => {
    const val = Number(c.total_penjualan ?? 0);
    const pct = Number(c.pct ?? 0) > 0 ? Number(c.pct) : (val / totalCatPenjualan) * 100;
    return { ...c, pct, fill: CC[i % CC.length] };
  });

  const ketData = keteranganBreakdown.slice(0, 5).map(k => ({
    keterangan: k.keterangan ?? '(kosong)',
    qty:        Number(k.penjualan ?? 0),
    count:      Number(k.count     ?? 0),
  }));

  const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  // Mobile: tampilkan setiap 2 bulan agar tidak crowded
  const BULAN_NAMES_SHORT = isMobile
    ? ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
    : BULAN_NAMES;

  const pivotPenj: Record<string, any>[] = BULAN_NAMES_SHORT.map(b => ({ bulan: b }));
  const pivotSO:   Record<string, any>[] = BULAN_NAMES_SHORT.map(b => ({ bulan: b }));

  monthly.forEach((m: any) => {
    const yr  = m.tahun;
    const idx = (m.bulan ?? 1) - 1;
    if (idx < 0 || idx > 11) return;
    pivotPenj[idx][yr] = Number(m.penjualan  ?? 0);
    pivotSO[idx][yr]   = Number(m.so         ?? 0);
    pivotSO[idx][`out_${yr}`] = Number(m.outstanding ?? 0);
  });

  const YearLegend = () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {allYears.map((yr, i) => (
        <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length].bar, border: `1px solid ${YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length].border}`, display: 'inline-block' }} />
          <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{yr}</span>
        </div>
      ))}
    </div>
  );

  const tabBtn = (mode: ChartMode, label: string) => (
    <button
      key={mode}
      onClick={() => setChartMode(mode)}
      style={{
        fontSize: 8, padding: '2px 8px', borderRadius: 4, border: 'none',
        fontFamily: FONT_MONO, cursor: 'pointer',
        background: chartMode === mode ? t.card1bg : 'transparent',
        color:      chartMode === mode ? t.text    : t.textMuted,
        fontWeight: chartMode === mode ? 700       : 400,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );

  const pillTertinggi = chartMode === 'penj'
    ? fmtRp(Math.max(0, ...monthly.map((m: any) => Number(m.penjualan ?? 0))))
    : Math.max(0, ...monthly.map((m: any) => Number(m.so ?? 0))).toLocaleString('id-ID') + ' qty';

  const pillRataRata = chartMode === 'penj'
    ? (monthly.length > 0 ? fmtRp(monthly.reduce((s: number, m: any) => s + Number(m.penjualan ?? 0), 0) / monthly.length) : '—')
    : (monthly.length > 0 ? (monthly.reduce((s: number, m: any) => s + Number(m.so ?? 0), 0) / monthly.length).toFixed(0) + ' qty' : '—');

  const qtyTerkirimSO = summary.qty_so - summary.total_outstanding;

  // ── Chart node ──
  const ChartNode = (
    <Card
      theme={theme}
      title="Tren Bulanan"
      icon={<TrendingUp size={10} color="#6366f1" />}
      color="#6366f1" accent="#6366f1"
      sub={
        allYears.length > 1
          ? `${allYears[0]}–${allYears[allYears.length - 1]} · grouped per bulan`
          : `${monthly.length} bulan`
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
        <YearLegend />
        <div style={{ display: 'flex', gap: 2, background: t.inputBg, borderRadius: 6, padding: 2, flexShrink: 0 }}>
          {tabBtn('penj', 'Penjualan (Rp)')}
          {tabBtn('so',   'SO & Outstanding')}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={chartMode === 'penj' ? pivotPenj : pivotSO}
          margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
          barCategoryGap="20%"
          barGap={1}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
          <XAxis
            dataKey="bulan"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: isMobile ? 8 : 9, fill: t.textMuted, fontFamily: FONT_MONO }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: isMobile ? 8 : 9, fill: t.textMuted, fontFamily: FONT_MONO }}
            width={chartMode === 'penj' ? (isMobile ? 44 : 56) : 44}
            tickFormatter={chartMode === 'penj'
              ? fmtRp
              : (v: number) => v.toLocaleString('id-ID')}
          />
          <Tooltip content={<ChartTooltip theme={theme} currency={chartMode === 'penj'} />} />

          {chartMode === 'penj'
            ? allYears.map((yr, i) => (
                <Bar
                  key={yr}
                  dataKey={String(yr)}
                  name={String(yr)}
                  fill={YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length].bar}
                  stroke={YEAR_BAR_COLORS[i % YEAR_BAR_COLORS.length].border}
                  strokeWidth={0.5}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                />
              ))
            : allYears.flatMap((yr, i) => [
                <Bar key={`so_${yr}`} dataKey={String(yr)} name={`SO ${yr}`}
                  fill={SO_BAR_COLORS[i % SO_BAR_COLORS.length].bar}
                  stroke={SO_BAR_COLORS[i % SO_BAR_COLORS.length].border}
                  strokeWidth={0.5} radius={[3, 3, 0, 0]} maxBarSize={10} />,
                <Bar key={`out_${yr}`} dataKey={`out_${yr}`} name={`Out ${yr}`}
                  fill={OUT_BAR_COLORS[i % OUT_BAR_COLORS.length].bar}
                  stroke={OUT_BAR_COLORS[i % OUT_BAR_COLORS.length].border}
                  strokeWidth={0.5} radius={[3, 3, 0, 0]} maxBarSize={10} />,
              ])
          }
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 4 }}>
        {[
          { label: 'Tertinggi',      value: pillTertinggi,                  color: '#6366f1' },
          { label: 'Rata-rata/bulan', value: pillRataRata,                   color: '#10b981' },
          { label: 'Outstanding',    value: `${outstandingPct.toFixed(1)}%`, color: outColor  },
        ].map(pill => (
          <div key={pill.label} style={{ flex: 1, background: t.inputBg, borderRadius: 6, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: isMobile ? 7 : 8, color: t.textMuted, fontFamily: FONT_MONO }}>{pill.label}</span>
            <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color: pill.color, fontFamily: FONT_MONO }}>{pill.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );

  // ── Tipe Pelanggan node ──
  const TipePelangganNode = (
    <Card theme={theme} title="Tipe Pelanggan" icon={<Users size={10} color="#8b5cf6" />} color="#8b5cf6" accent="#8b5cf6">
      {tcData.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tcData.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: i < tcData.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 9.5, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT_MONO }}>{d.name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{d.pct.toFixed(1)}%</span>
                  <span style={{ fontSize: 7.5, color: t.textMuted, fontFamily: FONT_MONO }}>{fmtRpFull(d.value)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Sembunyikan mini bar chart di mobile untuk hemat ruang */}
          {!isMobile && (
            <div style={{ flex: 1, minHeight: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tcData} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gs} horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtRp} tick={{ fontSize: 7, fill: t.textMuted, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 7, fill: t.textMuted, fontFamily: FONT_MONO }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<ChartTooltip theme={theme} currency={true} />} />
                  <Bar dataKey="value" name="Penjualan" radius={[0, 3, 3, 0]} maxBarSize={10}>
                    {tcData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : <div style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 16 }}>Tidak ada data</div>}
    </Card>
  );

  // ── Status Outstanding node ──
  const StatusOutstandingNode = (
    <Card theme={theme} title="Status Outstanding" icon={<AlertCircle size={10} color={outColor} />} color={outColor} accent={outColor}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color: outColor, fontFamily: FONT_MONO, lineHeight: 1 }}>{outstandingPct.toFixed(1)}%</div>
          <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 4 }}>dari Total Quantity SO</div>
        </div>
        <ProgressBar pct={outstandingPct} color={outColor} bg={t.borderCard} height={6} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { label: 'Qty Order',  value: summary.qty_so.toLocaleString('id-ID'),            color: '#6366f1' },
            { label: 'Qty Kirim',  value: qtyTerkirimSO.toLocaleString('id-ID'),             color: '#10b981' },
            { label: 'Sisa (Qty)', value: summary.total_outstanding.toLocaleString('id-ID'), color: outColor  },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  // ── Top Pelanggan node ──
  const TopPelangganNode = (
    <Card theme={theme} title="Top Pelanggan" icon={<Users size={10} color="#f59e0b" />} color="#f59e0b" accent="#f59e0b">
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {topCustomers.slice(0, 7).map((c, i) => {
          const maxVal = Number(topCustomers[0]?.total_penjualan ?? 1) || 1;
          const pct    = (Number(c.total_penjualan ?? 0) / maxVal) * 100;
          return (
            <div key={i} style={{ padding: '5px 0', borderBottom: i < 6 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ flex: 1, marginRight: 8, overflow: 'hidden' }}>
                  <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{c.pelanggan}</span>
                  <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{c.type_customer ?? '—'} · {Number(c.transaksi ?? 0)} transaksi</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', fontFamily: FONT_MONO, flexShrink: 0 }}>{fmtRpFull(Number(c.total_penjualan ?? 0))}</span>
              </div>
              <ProgressBar pct={pct} color="#f59e0b" bg={t.borderCard} height={3} />
            </div>
          );
        })}
      </div>
    </Card>
  );

  // ── Kategori Produk node ──
  const KategoriProdukNode = (
    <Card theme={theme} title="Kategori Produk" icon={<Package size={10} color="#10b981" />} color="#10b981" accent="#10b981">
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {categoriesWithPct.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: i < categoriesWithPct.length - 1 ? `1px solid ${t.border}` : 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: c.fill, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 9.5, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT_MONO }}>{c.kategori}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: t.text, fontFamily: FONT_MONO, flexShrink: 0 }}>{c.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );

  // ── Produk Outstanding node ──
  const ProdukOutstandingNode = (
    <Card theme={theme} title="Produk Outstanding" icon={<Tag size={10} color="#ec4899" />} color="#ec4899" accent="#ec4899">
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {ketData.length > 0 ? ketData.map((k, i) => {
          const maxVal = ketData[0]?.qty || 1;
          const pct    = (k.qty / maxVal) * 100;
          return (
            <div key={i} style={{ padding: '5px 0', borderBottom: i < ketData.length - 1 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{k.keterangan}</span>
                <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, flexShrink: 0 }}>{k.count}×</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ProgressBar pct={pct} color="#ec4899" bg={t.borderCard} height={3} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ec4899', fontFamily: FONT_MONO, flexShrink: 0 }}>
                  {k.qty.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          );
        }) : <div style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 16 }}>Tidak ada data</div>}
      </div>
    </Card>
  );

  // ══════════════════════════════════════════
  // MOBILE layout  (< 640px) — full scroll, 1 column
  // ══════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, overflowY: 'auto', paddingBottom: 16 }}>
        {/* KPI: 2×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          <KpiCard
            bg={t.card1bg} border={t.card1border} labelColor={t.card1text} accent={t.card1accent}
            label="Total Penjualan" value={summary.total_penjualan.toLocaleString('id-ID')}
            sub={fmtRpFull(summary.total_penjualan)} icon={<Receipt size={18} />} theme={theme}
          />
          <KpiCard
            bg={t.card2bg} border={t.card2border} labelColor={t.card2text} accent={t.card2accent}
            label="Sales Order" value={summary.total_so.toLocaleString('id-ID')}
            sub={`${summary.total_so.toLocaleString('id-ID')} qty`} icon={<ShoppingCart size={18} />} theme={theme}
          />
          <KpiCard
            bg={t.card3bg} border={t.card3border} labelColor={t.card3text} accent={t.card3accent}
            label="Outstanding" value={summary.total_outstanding.toLocaleString('id-ID')}
            sub={`${outstandingPct.toFixed(1)}% dari SO`} icon={<AlertCircle size={18} />} theme={theme}
          />
          <KpiCard
            bg={t.card4bg} border={t.card4border} labelColor={t.card4text} accent={t.card4accent}
            label="Transaksi" value={summary.transaksi.toLocaleString('id-ID')}
            icon={<Package size={18} />} theme={theme}
          />
        </div>

        {/* Chart full width */}
        {ChartNode}

        {/* Status Outstanding full width */}
        {StatusOutstandingNode}

        {/* 2-col: Tipe Pelanggan + Kategori */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          {TipePelangganNode}
          {KategoriProdukNode}
        </div>

        {/* Top Pelanggan full width */}
        {TopPelangganNode}

        {/* Produk Outstanding full width */}
        {ProdukOutstandingNode}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // TABLET layout  (640–1023px) — scroll, 2-col focus
  // ══════════════════════════════════════════
  if (isTablet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, overflowY: 'auto', paddingBottom: 16 }}>
        {/* KPI: 4 kolom */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: GAP }}>
          <KpiCard
            bg={t.card1bg} border={t.card1border} labelColor={t.card1text} accent={t.card1accent}
            label="Total Penjualan" value={fmtRpFull(summary.total_penjualan)}
            sub={fmtRpFull(summary.total_penjualan)} icon={<Receipt size={14} />} theme={theme}
          />
          <KpiCard
            bg={t.card2bg} border={t.card2border} labelColor={t.card2text} accent={t.card2accent}
            label="Sales Order (SO)" value={summary.total_so.toLocaleString('id-ID')}
            sub={`${summary.total_so.toLocaleString('id-ID')} qty`} icon={<ShoppingCart size={14} />} theme={theme}
          />
          <KpiCard
            bg={t.card3bg} border={t.card3border} labelColor={t.card3text} accent={t.card3accent}
            label="Outstanding" value={summary.total_outstanding.toLocaleString('id-ID')}
            sub={`${outstandingPct.toFixed(1)}% dari SO`} icon={<AlertCircle size={14} />} theme={theme}
          />
          <KpiCard
            bg={t.card4bg} border={t.card4border} labelColor={t.card4text} accent={t.card4accent}
            label="Total Transaksi" value={summary.transaksi.toLocaleString('id-ID')}
            icon={<Package size={14} />} theme={theme}
          />
        </div>

        {/* Row 1: Chart (2/3) + Status Outstanding (1/3) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: GAP }}>
          {ChartNode}
          {StatusOutstandingNode}
        </div>

        {/* Row 2: Tipe Pelanggan (1/2) + Top Pelanggan (1/2) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          {TipePelangganNode}
          {TopPelangganNode}
        </div>

        {/* Row 3: Kategori Produk (1/2) + Produk Outstanding (1/2) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP }}>
          {KategoriProdukNode}
          {ProdukOutstandingNode}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DESKTOP layout  (≥ 1024px) — original fixed-height
  // ══════════════════════════════════════════
  const KPI_H = 106;
  const bodyH = availH - KPI_H - GAP * 4;
  const rowH  = Math.max(100, Math.floor((bodyH - GAP) / 2));

  return (
    <div style={{ height: availH, display: 'flex', flexDirection: 'column', gap: GAP, overflow: 'hidden' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: GAP, height: KPI_H, flexShrink: 0 }}>
        <KpiCard
          bg={t.card1bg} border={t.card1border} labelColor={t.card1text} accent={t.card1accent}
          label="Total Penjualan" value={fmtRpFull(summary.total_penjualan)}
          sub={fmtRpFull(summary.total_penjualan)} icon={<Receipt size={14} />} theme={theme}
        />
        <KpiCard
          bg={t.card2bg} border={t.card2border} labelColor={t.card2text} accent={t.card2accent}
          label="Sales Order (SO)" value={summary.total_so.toLocaleString('id-ID')}
          sub={`${summary.total_so.toLocaleString('id-ID')} qty`} icon={<ShoppingCart size={14} />} theme={theme}
        />
        <KpiCard
          bg={t.card3bg} border={t.card3border} labelColor={t.card3text} accent={t.card3accent}
          label="Outstanding" value={summary.total_outstanding.toLocaleString('id-ID')}
          sub={`${outstandingPct.toFixed(1)}% dari SO`} icon={<AlertCircle size={14} />} theme={theme}
        />
        <KpiCard
          bg={t.card4bg} border={t.card4border} labelColor={t.card4text} accent={t.card4accent}
          label="Total Transaksi" value={summary.transaksi.toLocaleString('id-ID')}
          icon={<Package size={14} />} theme={theme}
        />
      </div>

      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: GAP, height: rowH, flexShrink: 0 }}>
        {ChartNode}
        {TipePelangganNode}
        {StatusOutstandingNode}
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: GAP, flex: 1, minHeight: 0 }}>
        {TopPelangganNode}
        {KategoriProdukNode}
        {ProdukOutstandingNode}
      </div>
    </div>
  );
}