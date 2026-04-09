'use client';
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line,
} from 'recharts';
import { ShoppingCart, TrendingUp, Package, Users } from 'lucide-react';
import { Theme, tk, fmtRp, fmtRpFull, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { Card, ChartTooltip, mkTick, ProgressBar } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; }

export default function SalesOrderTab({ data, theme }: Props) {
  const t  = tk[theme];
  const ts = mkTick(theme);
  const gs = t.gridStroke;

  const monthly      = Array.isArray(data.monthly)      ? data.monthly      : [];
  const weekly       = Array.isArray(data.weekly)        ? data.weekly       : [];
  const topCustomers = Array.isArray(data.topCustomers)  ? data.topCustomers : [];
  const categories   = Array.isArray(data.categories)    ? data.categories   : [];

  // SO vs Penjualan ratio per bulan
  // monthly sudah punya field: penjualan, so, outstanding, terkirim
  const ratioData = monthly.map(m => ({
    label:     m.label,
    so:        Number(m.so        ?? 0),
    penjualan: Number(m.penjualan ?? 0),
    ratio:     (m.so ?? 0) > 0 ? (Number(m.penjualan) / Number(m.so)) * 100 : 0,
  }));

  // Weekly hanya punya field: minggu, penjualan
  const weeklyData = weekly.map(w => ({
    minggu:    w.minggu,
    penjualan: Number(w.penjualan ?? 0),
  }));

  // Top customers — field yang tersedia: pelanggan, type_customer, total_penjualan, transaksi
  const maxCustVal = Math.max(...topCustomers.map(c => Number(c.total_penjualan ?? 0)), 1);

  // Kategori untuk tabel
  const totalCatVal = categories.reduce((s, c) => s + Number(c.total_penjualan ?? 0), 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── SO vs Penjualan Bulanan ── */}
      <Card
        theme={theme}
        title="Sales Order vs Penjualan (Bulanan)"
        icon={<ShoppingCart size={10} color="#10b981" />}
        color="#10b981" accent="#10b981"
        sub="Nilai SO dibanding realisasi penjualan"
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={ratioData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gSO" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPJ" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
            <XAxis dataKey="label" tick={ts} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tickFormatter={fmtRp} tick={ts} axisLine={false} tickLine={false} width={60} />
            <YAxis yAxisId="r" orientation="right" tickFormatter={v => `${Number(v).toFixed(0)}%`} tick={ts} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<ChartTooltip theme={theme} />} />
            <Area yAxisId="l" type="monotone" dataKey="so"        name="SO"          fill="url(#gSO)" stroke="#10b981" strokeWidth={2}   dot={false} />
            <Area yAxisId="l" type="monotone" dataKey="penjualan" name="Penjualan"   fill="url(#gPJ)" stroke="#6366f1" strokeWidth={2}   dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="ratio"     name="Realisasi %" stroke="#f59e0b" strokeWidth={1.4} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* ── Penjualan Mingguan ── */}
        <Card
          theme={theme}
          title="Penjualan Mingguan"
          icon={<TrendingUp size={10} color="#10b981" />}
          color="#10b981" accent="#10b981"
        >
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
              <XAxis
                dataKey="minggu"
                tickFormatter={v => `W${v}`}
                tick={ts} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(weeklyData.length / 10))}
              />
              <YAxis tickFormatter={fmtRp} tick={ts} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip theme={theme} />} />
              <Bar dataKey="penjualan" name="Penjualan" fill="#10b981" opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
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
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', fontFamily: FONT_MONO, flexShrink: 0 }}>{val.toLocaleString('id-ID')}</span>
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