'use client';
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { AlertCircle, TrendingDown, Package } from 'lucide-react';
import { Theme, tk, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { Card, ChartTooltip, mkTick, ProgressBar } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; tahun?: string; }

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

export default function OutstandingTab({ data, theme, tahun }: Props) {
  const t  = tk[theme];
  const ts = mkTick(theme);
  const gs = t.gridStroke;
  const bp = useBreakpoint();

  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isDesktop = bp === 'desktop';

  const summary             = (data.summary ?? {}) as any;
  const monthly             = Array.isArray(data.monthly)             ? data.monthly             : [];
  const topOutstanding      = Array.isArray(data.topOutstanding)      ? data.topOutstanding      : [];
  const keteranganBreakdown = Array.isArray(data.keteranganBreakdown) ? data.keteranganBreakdown : [];

  const totalSO          = Number(summary.total_so          ?? 0);
  const totalOutstanding = Number(summary.total_outstanding ?? 0);
  const totalDelivered   = Number(summary.total_delivered   ?? (totalSO - totalOutstanding));
  const outstandingPct   = Number(summary.pct_outstanding   ?? 0);
  const outColor         = outstandingPct > 50 ? '#ef4444' : outstandingPct > 25 ? '#f59e0b' : '#1062b9';

  const monthlyOut = monthly
    .filter((m: any) => !tahun || tahun === 'all' || Number(m.tahun) === Number(tahun))
    .map((m: any) => ({
      label:       m.label,
      outstanding: Number(m.outstanding ?? 0),
      delivered:   Number(m.delivered   ?? 0),
    }));

  const pieData = [
    { name: 'Terkirim', value: totalDelivered,   fill: '#10b981' },
    { name: 'Sisa',     value: totalOutstanding,  fill: outColor  },
  ];

  const maxSisa = Math.max(...topOutstanding.map(r => Number(r.qty_sisa ?? 0)), 1);
  const maxKet  = Math.max(...keteranganBreakdown.map(k => Number(k.penjualan ?? 0)), 1);

  // ── Summary cards ──
  const summaryCards = [
    {
      label: 'Total SO (Qty)',
      value: totalSO.toLocaleString('id-ID'),
      sub:   'Total qty dipesan',
      color: '#6366f1', bg: t.card1bg, border: t.card1border,
    },
    {
      label: 'Qty Terkirim',
      value: totalDelivered.toLocaleString('id-ID'),
      sub:   `${(100 - outstandingPct).toFixed(1)}% dari SO`,
      color: '#10b981', bg: t.card2bg, border: t.card2border,
    },
    {
      label: 'Qty Outstanding',
      value: totalOutstanding.toLocaleString('id-ID'),
      sub:   `${outstandingPct.toFixed(1)}% belum terkirim`,
      color: outColor, bg: t.card4bg, border: t.card4border,
    },
  ];

  const SummaryRow = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)',
      gap: isMobile ? 8 : 12,
    }}>
      {summaryCards.map((card, idx) => (
        // Mobile: kartu ke-3 (Outstanding) span full width
        <div
          key={card.label}
          style={{
            gridColumn: isMobile && idx === 2 ? '1 / -1' : undefined,
            borderRadius: 13,
            padding: isMobile ? '10px 12px' : '14px 16px',
            background: card.bg,
            border: `1px solid ${card.border}`,
          }}
        >
          <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 5 }}>{card.label}</div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
          <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 4 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );

  // ── Monthly outstanding chart ──
  const monthlyChartH = isMobile ? 150 : 180;
  const MonthlyChart = (
    <Card
      theme={theme}
      title="Outstanding per Bulan"
      icon={<TrendingDown size={10} color={outColor} />}
      color={outColor} accent={outColor}
      sub="Qty outstanding vs terkirim per bulan"
    >
      <ResponsiveContainer width="100%" height={monthlyChartH}>
        <BarChart data={monthlyOut} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ ...ts, fontSize: isMobile ? 8 : isTablet ? 9 : isDesktop ? 10 : undefined }}
            axisLine={false} tickLine={false}
            interval={isMobile ? Math.max(0, Math.floor(monthlyOut.length / 6)) : 0}
          />
          <YAxis
            tick={{ ...ts, fontSize: isMobile ? 8 : isTablet ? 9 : isDesktop ? 10 : undefined }}
            axisLine={false} tickLine={false}
            width={isMobile ? 36 : 50}
            tickFormatter={(v: number) => v.toLocaleString('id-ID')}
          />
          <Tooltip content={<ChartTooltip theme={theme} currency={false} />} />
          <Bar dataKey="delivered"   name="Terkirim"    stackId="a" fill="#10b981" opacity={0.8} maxBarSize={28} />
          <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill={outColor} opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );

  // ── Pie komposisi SO ──
  // Mobile: ukuran pie lebih kecil, layout horizontal
  const PieSize    = isMobile ? 100 : 120;
  const PieInner   = isMobile ? 28  : 34;
  const PieOuter   = isMobile ? 46  : 55;
  const PieCx      = isMobile ? 48  : 55;
  const PieCy      = isMobile ? 48  : 55;

  const PieNode = (
    <Card
      theme={theme}
      title="Komposisi SO"
      icon={<AlertCircle size={10} color={outColor} />}
      color={outColor} accent={outColor}
    >
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        alignItems: 'center',
        gap: isMobile ? 12 : 10,
        flex: 1,
        justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', width: PieSize, height: PieSize, flexShrink: 0 }}>
          <PieChart width={PieSize} height={PieSize}>
            <Pie
              data={pieData} cx={PieCx} cy={PieCy}
              innerRadius={PieInner} outerRadius={PieOuter}
              dataKey="value" paddingAngle={2}
              strokeWidth={0} startAngle={90} endAngle={-270}
            >
              {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
          </PieChart>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: outColor, fontFamily: FONT_MONO, lineHeight: 1 }}>{outstandingPct.toFixed(0)}%</div>
            <div style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>sisa</div>
          </div>
        </div>
        <div style={{ width: isMobile ? undefined : '100%', flex: isMobile ? 1 : undefined, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {pieData.map(d => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO }}>{d.name}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>{d.value.toLocaleString('id-ID')}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  // ── Top SO Outstanding ──
  const TopSONode = (
    <Card
      theme={theme}
      title="Top SO Outstanding"
      icon={<AlertCircle size={10} color={outColor} />}
      color={outColor} accent={outColor}
      sub="SO dengan sisa qty terbanyak"
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {topOutstanding.length > 0 ? topOutstanding.map((r, i) => {
          const sisa = Number(r.qty_sisa ?? 0);
          const pct  = (sisa / maxSisa) * 100;
          return (
            <div key={`${r.nomor_so}-${i}`} style={{ padding: '6px 0', borderBottom: i < topOutstanding.length - 1 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ flex: 1, marginRight: 8, overflow: 'hidden' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nomor_so}</div>
                  <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pelanggan}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: outColor, fontFamily: FONT_MONO, flexShrink: 0 }}>{sisa.toLocaleString('id-ID')}</span>
              </div>
              <ProgressBar pct={pct} color={outColor} bg={t.borderCard} height={3} />
            </div>
          );
        }) : (
          <div style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 20 }}>Tidak ada outstanding</div>
        )}
      </div>
    </Card>
  );

  // ── Produk Outstanding ──
  const ProdukNode = (
    <Card
      theme={theme}
      title="Outstanding per Produk"
      icon={<Package size={10} color="#8b5cf6" />}
      color="#8b5cf6" accent="#8b5cf6"
      sub="Qty sisa per produk"
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {keteranganBreakdown.length > 0 ? keteranganBreakdown.map((k, i) => {
          const qty = Number(k.penjualan ?? 0);
          const pct = (qty / maxKet) * 100;
          return (
            <div key={`${k.keterangan}-${i}`} style={{ padding: '5px 0', borderBottom: i < keteranganBreakdown.length - 1 ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{k.keterangan}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', fontFamily: FONT_MONO, flexShrink: 0 }}>{qty.toLocaleString('id-ID')}</span>
              </div>
              <ProgressBar pct={pct} color="#8b5cf6" bg={t.borderCard} height={3} />
            </div>
          );
        }) : (
          <div style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 20 }}>Tidak ada data</div>
        )}
      </div>
    </Card>
  );

  // ══════════════════════════════════════════
  // MOBILE  (< 640px) — full stack vertikal
  // ══════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SummaryRow}
        {MonthlyChart}
        {/* Pie + Top SO: 2 kolom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr ', gap: 10 }}>
          {PieNode}
          {TopSONode}
        </div>
        {ProdukNode}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // TABLET  (640–1023px)
  // ══════════════════════════════════════════
  if (isTablet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SummaryRow}
        {/* Monthly chart (2/3) + Pie (1/3) */}
        <div style={{ display: 'grid', gridTemplateColumns: ' 1fr', gap: 12 }}>
          {MonthlyChart}
          {PieNode}
        </div>
        {/* Top SO + Produk: 2 kolom */}
        <div style={{ display: 'grid', gridTemplateColumns: ' 1fr', gap: 12 }}>
          {TopSONode}
          {ProdukNode}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DESKTOP  (≥ 1024px) — layout asli
  // ══════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {SummaryRow}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        {MonthlyChart}
        {PieNode}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: ' 1fr', gap: 12 }}>
        {TopSONode}
        {ProdukNode}
      </div>
    </div>
  );
}