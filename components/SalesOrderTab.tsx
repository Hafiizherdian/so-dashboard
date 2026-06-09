'use client';
import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ComposedChart,
  Area, Line,
} from 'recharts';
import { ShoppingCart, TrendingUp, Package, Users } from 'lucide-react';
import { Theme, tk, fmtRp, fmtRpFull, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { Card, ChartTooltip, mkTick, ProgressBar } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; tahun?: string; }

export default function SalesOrderTab({ data, theme, tahun }: Props) {
  const t  = tk[theme];
  const ts = mkTick(theme);
  const gs = t.gridStroke;

  const monthly = (Array.isArray(data.monthly) ? data.monthly : [])
    .filter((m: any) => !tahun || tahun === 'all' || Number(m.tahun) === Number(tahun));
  const weeklySO     = Array.isArray((data as any).weeklySO)        ? (data as any).weeklySO        : [];
  const topCustomers = Array.isArray(data.topCustomers)             ? data.topCustomers             : [];
  const categories   = Array.isArray(data.categories)              ? data.categories               : [];

  // ── SO vs Delivered ratio per bulan (semua dari so_outstanding) ───────────
  const ratioData = monthly.map((m: any) => ({
    label:     m.label,
    so:        Number(m.so        ?? 0),
    delivered: Number(m.delivered ?? 0),
    ratio:     (m.so ?? 0) > 0 ? (Number(m.delivered ?? 0) / Number(m.so)) * 100 : 0,
  }));

  // ── Weekly SO — dari weeklySO (so_outstanding) ────────────────────────────
  const weeklyData = weeklySO.map((w: any) => ({
    minggu:        w.minggu,
    qty_order:     Number(w.qty_order     ?? 0),
    qty_delivered: Number(w.qty_delivered ?? 0),
    qty_sisa:      Number(w.qty_sisa      ?? 0),
  }));

  // ── Top customers ──────────────────────────────────────────────────────────
  const maxCustVal = Math.max(...topCustomers.map(c => Number(c.total_penjualan ?? 0)), 1);

  // ── Kategori ───────────────────────────────────────────────────────────────
  const totalCatVal = categories.reduce((s, c) => s + Number(c.total_penjualan ?? 0), 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── SO vs Qty Delivered Bulanan ── */}
      <Card
        theme={theme}
        title="Sales Order vs Qty Delivered (Bulanan)"
        icon={<ShoppingCart size={10} color="#10b981" />}
        color="#10b981" accent="#10b981"
        sub="Qty SO dibanding qty terkirim per bulan (dari SO Outstanding)"
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={ratioData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gSO" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gDL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
            <XAxis dataKey="label" tick={ts} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="l"
              tickFormatter={(v: number) => v.toLocaleString('id-ID')}
              tick={ts} axisLine={false} tickLine={false} width={60}
            />
            <YAxis
              yAxisId="r"
              orientation="right"
              tickFormatter={(v: number) => `${Number(v).toFixed(0)}%`}
              tick={ts} axisLine={false} tickLine={false} width={36}
            />
            <Tooltip content={<ChartTooltip theme={theme} currency={false} />} />
            <Area yAxisId="l" type="monotone" dataKey="so"        name="SO (Qty)"        fill="url(#gSO)" stroke="#10b981" strokeWidth={2}   dot={false} />
            <Area yAxisId="l" type="monotone" dataKey="delivered" name="Delivered (Qty)"  fill="url(#gDL)" stroke="#6366f1" strokeWidth={2}   dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="ratio"     name="Realisasi %"     stroke="#f59e0b" strokeWidth={1.4} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* ── Weekly SO — qty_order vs qty_delivered vs qty_sisa ── */}
        <Card
          theme={theme}
          title="SO Mingguan (Qty)"
          icon={<TrendingUp size={10} color="#10b981" />}
          color="#10b981" accent="#10b981"
          sub="Qty Order vs Delivered vs Sisa per minggu"
        >
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }} barGap={1} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
              <XAxis
                dataKey="minggu"
                tickFormatter={(v: any) => `W${v}`}
                tick={ts} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(weeklyData.length / 10))}
              />
              <YAxis
                tickFormatter={(v: number) => v.toLocaleString('id-ID')}
                tick={ts} axisLine={false} tickLine={false} width={50}
              />
              <Tooltip content={<ChartTooltip theme={theme} currency={false} />} />
              <Bar dataKey="qty_order"     name="SO (Qty)"        fill="#6366f1" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="qty_delivered" name="Delivered (Qty)"  fill="#10b981" opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="qty_sisa"      name="Sisa (Qty)"      fill="#ef4444" opacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
          {/* Legend manual */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            {[
              { color: '#6366f1', label: 'SO' },
              { color: '#10b981', label: 'Delivered' },
              { color: '#ef4444', label: 'Sisa' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Top Pelanggan ── */}
        <Card
          theme={theme}
          title="Top Pelanggan"
          icon={<Users size={10} color="#f59e0b" />}
          color="#f59e0b" accent="#f59e0b"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, overflowY: 'auto' }}>
            {topCustomers.slice(0, 7).map((c, i) => {
              const val = Number(c.total_penjualan ?? 0);
              const pct = (val / maxCustVal) * 100;
              return (
                <div key={`${c.pelanggan}-${i}`} style={{ padding: '5px 0', borderBottom: i < 6 ? `1px solid ${t.border}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ flex: 1, marginRight: 8, overflow: 'hidden' }}>
                      <div style={{ fontSize: 10, color: t.text, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.pelanggan}</div>
                      <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{c.type_customer ?? '—'} · {Number(c.transaksi ?? 0)} trx</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', fontFamily: FONT_MONO, flexShrink: 0 }}>
                      {fmtRpFull(val)}
                    </span>
                  </div>
                  <ProgressBar pct={pct} color="#f59e0b" bg={t.borderCard} height={3} />
                </div>
              );
            })}
            {topCustomers.length === 0 && (
              <div style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', paddingTop: 16 }}>Tidak ada data</div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Tabel Kategori Produk ── */}
      <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: '#10b98115', border: '1px solid #10b98128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={11} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Kategori Produk</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>{categories.length} kategori</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 400, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['#', 'Kategori', 'Total Penjualan (Rp)', '% Kontribusi'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px',
                    textAlign: h === '#' ? 'center' : h.includes('Rp') || h.includes('%') ? 'right' : 'left',
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: t.textMuted,
                    borderBottom: `1px solid ${t.border}`,
                    fontFamily: FONT_MONO, background: t.tableHead,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => {
                const val = Number(c.total_penjualan ?? 0);
                const pct = (val / totalCatVal) * 100;
                return (
                  <tr
                    key={`${c.kategori}-${i}`}
                    style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
                  >
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: t.textMuted, fontFamily: FONT_MONO, fontSize: 10 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', color: t.text, fontFamily: FONT_MONO, fontSize: 11 }}>{c.kategori || '(Lainnya)'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: t.text, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700 }}>{fmtRpFull(val)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: t.textSub, fontFamily: FONT_MONO, fontSize: 11 }}>
                      <span style={{ padding: '2px 7px', borderRadius: 8, fontSize: 9, fontWeight: 600, background: t.infoBg, color: t.infoText, border: `1px solid ${t.infoBorder}` }}>
                        {pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: t.textMuted, fontSize: 11, fontFamily: FONT_MONO }}>
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}