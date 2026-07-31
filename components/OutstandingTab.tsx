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
            tick={{ ...ts, fontSize: isMobile ? 5 : isTablet ? 6 : isDesktop ? 8 : undefined }}
            axisLine={false} tickLine={false}
            interval={isMobile ? Math.max(0, Math.floor(monthlyOut.length / 6)) : 0}
          />
          <YAxis
            tick={{ ...ts, fontSize: isMobile ? 5 : isTablet ? 6 : isDesktop ? 8 : undefined }}
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

// ── Top SO Outstanding (table) ──
  const TopSONode = (
    <Card
      theme={theme}
      title="Top Outstanding SO "
      icon={<AlertCircle size={10} color={outColor} />}
      color={outColor} accent={outColor}
      sub="SO dengan sisa qty terbanyak"
    >
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
        <table style={{ minWidth: isMobile ? 280 : 380, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {(isMobile
                ? ['No', 'Produk', 'Sisa']
                : ['No', 'Produk', 'Pelanggan', 'Qty Sisa', 'Jumlah SO']
              ).map(h => (
                <th key={h} style={{
                  padding: isMobile ? '7px 8px' : '8px 10px',
                  textAlign: h === 'No' ? 'center' : (h === 'Sisa' || h === 'Qty Sisa'|| h === 'Jumlah SO') ? 'right' : 'left',
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: t.textMuted,
                  borderBottom: `1px solid ${t.border}`,
                  fontFamily: FONT_MONO, background: t.tableHead,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topOutstanding.map((r, i) => {
              const sisa = Number(r.qty_sisa ?? 0);
              const jumlahSO = Number((r as any).jumlah_so ?? 0);
              return (
                <tr
                  key={`${r.produk}-${i}`}
                  style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                >
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'center', color: t.text, fontFamily: FONT_MONO, fontSize: 10 }}>{i + 1}</td>
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', color: t.text, fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11, fontWeight: 700 }}>
                    {isMobile ? (
                      <div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{r.produk}</div>
                        <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{r.pelanggan}</div>
                      </div>
                    ) : (
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{r.produk}</div>
                    )}
                  </td>
                  {!isMobile && (
                    <td style={{ padding: '8px 10px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{r.pelanggan}</td>
                  )}
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'right', color: outColor, fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11, fontWeight: 700 }}>{sisa.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{jumlahSO.toLocaleString('id-ID')}</td>
                </tr>
              );
            })}
            {topOutstanding.length === 0 && (
              <tr>
                <td colSpan={isMobile ? 3 : 4} style={{ padding: '20px', textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>
                  Tidak ada outstanding
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // ── Sort state untuk tabel Outstanding per Produk ──
  type ProdukSortKey = 'keterangan' | 'nomor_so' | 'tanggal' | 'penjualan';
  const [produkSortKey, setProdukSortKey] = useState<ProdukSortKey>('penjualan');
  const [produkSortDir, setProdukSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedKeterangan = React.useMemo(() => {
    const arr = [...keteranganBreakdown];
    arr.sort((a: any, b: any) => {
      let va = a[produkSortKey];
      let vb = b[produkSortKey];
      if (produkSortKey === 'penjualan') {
        va = Number(va ?? 0);
        vb = Number(vb ?? 0);
      } else if (produkSortKey === 'tanggal') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = String(va ?? '').toLowerCase();
        vb = String(vb ?? '').toLowerCase();
      }
      if (va < vb) return produkSortDir === 'asc' ? -1 : 1;
      if (va > vb) return produkSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [keteranganBreakdown, produkSortKey, produkSortDir]);

  function handleProdukSort(key: ProdukSortKey) {
    if (produkSortKey === key) {
      setProdukSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setProdukSortKey(key);
      setProdukSortDir(key === 'penjualan' ? 'desc' : 'asc');
    }
  }

  const ProdukSortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
    <span style={{ fontSize: 8, marginLeft: 3, opacity: active ? 1 : 0.3 }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
  // ── Produk Outstanding (table) ──
  const ProdukNode = (
    <Card
      theme={theme}
      title="Outstanding per Produk"
      icon={<Package size={10} color="#8b5cf6" />}
      color="#8b5cf6" accent="#8b5cf6"
      sub="Qty sisa per baris SO"
    >
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
        <table style={{ minWidth: isMobile ? 260 : 420, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{
                padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'center',
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
              }}>No</th>

              <th
                onClick={() => handleProdukSort('keterangan')}
                style={{
                  padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
                }}
              >
                Produk <ProdukSortIcon active={produkSortKey === 'keterangan'} dir={produkSortDir} />
              </th>

              {!isMobile && (
                <th
                  onClick={() => handleProdukSort('nomor_so')}
                  style={{
                    padding: '8px 10px', textAlign: 'left', cursor: 'pointer', userSelect: 'none',
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
                  }}
                >
                  No SO <ProdukSortIcon active={produkSortKey === 'nomor_so'} dir={produkSortDir} />
                </th>
              )}

              {!isMobile && (
                <th
                  onClick={() => handleProdukSort('tanggal')}
                  style={{
                    padding: '8px 10px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
                  }}
                >
                  Tanggal SO <ProdukSortIcon active={produkSortKey === 'tanggal'} dir={produkSortDir} />
                </th>
              )}

              <th
                onClick={() => handleProdukSort('penjualan')}
                style={{
                  padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'right', cursor: 'pointer', userSelect: 'none',
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: t.textMuted, borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO, background: t.tableHead,
                }}
              >
                Qty Sisa <ProdukSortIcon active={produkSortKey === 'penjualan'} dir={produkSortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedKeterangan.map((k, i) => {
              const qty = Number(k.penjualan ?? 0);
              const tglFormatted = k.tanggal ? new Date(k.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
              return (
                <tr
                  key={`${k.keterangan}-${k.nomor_so}-${i}`}
                  style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                >
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'center', color: t.text, fontFamily: FONT_MONO, fontSize: 10 }}>{i + 1}</td>
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', color: t.text, fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11 }}>
                    {isMobile ? (
                      <div>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{k.keterangan}</div>
                        <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1 }}>{k.nomor_so} · {tglFormatted}</div>
                      </div>
                    ) : (
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{k.keterangan}</div>
                    )}
                  </td>
                  {!isMobile && (
                    <td style={{ padding: '8px 10px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>{k.nomor_so}</td>
                  )}
                  {!isMobile && (
                    <td style={{ padding: '8px 10px', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11, whiteSpace: 'nowrap' }}>{tglFormatted}</td>
                  )}
                  <td style={{ padding: isMobile ? '7px 8px' : '8px 10px', textAlign: 'right', color: '#8b5cf6', fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11, fontWeight: 700 }}>{qty.toLocaleString('id-ID')}</td>
                </tr>
              );
            })}
            {sortedKeterangan.length === 0 && (
              <tr>
                <td colSpan={isMobile ? 3 : 5} style={{ padding: '20px', textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
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