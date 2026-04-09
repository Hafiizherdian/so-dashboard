'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { AlertCircle, TrendingDown, Users, Package } from 'lucide-react';
import { Theme, tk, fmtRp, fmtRpFull, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { Card, ChartTooltip, mkTick, ProgressBar } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; }

export default function OutstandingTab({ data, theme }: Props) {
  const t  = tk[theme];
  const ts = mkTick(theme);
  const gs = t.gridStroke;

  const summary        = data.summary        ?? {};
  const monthly        = Array.isArray(data.monthly)        ? data.monthly        : [];
  const topOutstanding = Array.isArray(data.topOutstanding) ? data.topOutstanding : [];
  const keteranganBreakdown = Array.isArray(data.keteranganBreakdown) ? data.keteranganBreakdown : [];

  const totalOutstanding = Number(summary.total_outstanding ?? 0);
  const totalSO          = Number(summary.total_so          ?? 0);
  const outstandingPct   = Number(summary.pct_outstanding   ?? 0);
  const outColor         = outstandingPct > 50 ? '#ef4444' : outstandingPct > 25 ? '#f59e0b' : '#10b981';

  // ── Monthly outstanding bar ───────────────────────────────────────────────
  // monthly field: label, so, outstanding, penjualan, terkirim
  const monthlyOut = monthly.map(m => ({
    label:       m.label,
    outstanding: Number(m.outstanding ?? 0),
    terbayar:    Math.max(0, Number(m.so ?? 0) - Number(m.outstanding ?? 0)),
    pct:         (m.so ?? 0) > 0 ? (Number(m.outstanding) / Number(m.so)) * 100 : 0,
  }));

  // ── Pie data ──────────────────────────────────────────────────────────────
  const pieTerbayar = Math.max(0, totalSO - totalOutstanding);
  const pieData = [
    { name: 'Terkirim', value: pieTerbayar,    fill: '#10b981' },
    { name: 'Sisa',     value: totalOutstanding, fill: outColor  },
  ];

  // ── Top outstanding SO — dari topOutstanding (nomor_so, pelanggan, qty_sisa) ──
  const maxSisa = Math.max(...topOutstanding.map(r => Number(r.qty_sisa ?? 0)), 1);

  // ── Keterangan breakdown (produk outstanding) ─────────────────────────────
  const maxKet = Math.max(...keteranganBreakdown.map(k => Number(k.penjualan ?? 0)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          {
            label: 'Total SO (Qty)',
            value: totalSO.toLocaleString('id-ID'),
            sub:   'Total qty dipesan',
            color: '#6366f1', bg: t.card1bg, border: t.card1border,
          },
          {
            label: 'Qty Terkirim',
            value: pieTerbayar.toLocaleString('id-ID'),
            sub:   `${(100 - outstandingPct).toFixed(1)}% dari SO`,
            color: '#10b981', bg: t.card2bg, border: t.card2border,
          },
          {
            label: 'Qty Outstanding',
            value: totalOutstanding.toLocaleString('id-ID'),
            sub:   `${outstandingPct.toFixed(1)}% belum terkirim`,
            color: outColor, bg: t.card4bg, border: t.card4border,
          },
        ].map(card => (
          <div key={card.label} style={{ borderRadius: 13, padding: '14px 16px', background: card.bg, border: `1px solid ${card.border}` }}>
            <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: card.color, fontWeight: 700, marginBottom: 7 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: 9.5, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 5 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>

        {/* ── Monthly outstanding chart ── */}
        <Card
          theme={theme}
          title="Outstanding per Bulan"
          icon={<TrendingDown size={10} color={outColor} />}
          color={outColor} accent={outColor}
          sub="Qty outstanding vs terkirim per bulan"
        >
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyOut} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
              <XAxis dataKey="label" tick={ts} axisLine={false} tickLine={false} />
              <YAxis tick={ts} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<ChartTooltip theme={theme} />} />
              <Bar dataKey="terbayar"    name="Terkirim"     stackId="a" fill="#10b981" opacity={0.8} maxBarSize={28} />
              <Bar dataKey="outstanding" name="Outstanding"  stackId="a" fill={outColor} opacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Pie komposisi SO ── */}
        <Card
          theme={theme}
          title="Komposisi SO"
          icon={<AlertCircle size={10} color={outColor} />}
          color={outColor} accent={outColor}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <PieChart width={120} height={120}>
                <Pie
                  data={pieData} cx={55} cy={55}
                  innerRadius={34} outerRadius={55}
                  dataKey="value" paddingAngle={2}
                  strokeWidth={0} startAngle={90} endAngle={-270}
                >
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: outColor, fontFamily: FONT_MONO, lineHeight: 1 }}>{outstandingPct.toFixed(0)}%</div>
                <div style={{ fontSize: 8, color: t.textMuted, fontFamily: FONT_MONO }}>sisa</div>
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* ── Top SO Outstanding (nomor_so + pelanggan + qty_sisa) ── */}
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

        {/* ── Produk Outstanding (keteranganBreakdown = grouping per produk) ── */}
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
      </div>
    </div>
  );
}