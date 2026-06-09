'use client';
import React, { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, BarChart,
} from 'recharts';
import { Receipt, Users, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { Theme, tk, CC, fmtRp, fmtRpFull, FONT_MONO } from '@/lib/theme';
import { DashboardData } from '@/types/index';
import { Card, ChartTooltip, mkTick } from '@/components/ui';

interface Props { data: DashboardData; theme: Theme; }

type SortKey = 'total_penjualan' | 'transaksi';
type SortDir  = 'asc' | 'desc';

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

export default function PenjualanTab({ data, theme }: Props) {
  const t  = tk[theme];
  const ts = mkTick(theme);
  const gs = t.gridStroke;
  const bp = useBreakpoint();

  const isMobile  = bp === 'mobile';
  const isTablet  = bp === 'tablet';

  const [sortKey, setSortKey] = useState<SortKey>('total_penjualan');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search,  setSearch]  = useState('');

  const weekly                = Array.isArray(data.weekly)                ? data.weekly                : [];
  const topCustomers          = Array.isArray(data.topCustomers)          ? data.topCustomers          : [];
  const categories            = Array.isArray(data.categories)            ? data.categories            : [];
  const typeCustomerBreakdown = Array.isArray(data.typeCustomerBreakdown) ? data.typeCustomerBreakdown : [];

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const filteredCustomers = topCustomers
    .filter(c => (c.pelanggan ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    k === sortKey
      ? (sortDir === 'asc'
          ? <ChevronUp  size={10} color="#6366f1" />
          : <ChevronDown size={10} color="#6366f1" />)
      : <ChevronUp size={10} color={t.textFaint} />;

  const thS: React.CSSProperties = {
    padding: isMobile ? '7px 8px' : '8px 10px',
    textAlign: 'left', fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textMuted,
    borderBottom: `1px solid ${t.border}`, fontFamily: FONT_MONO,
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    background: t.tableHead,
  };

  // ── Weekly interval: lebih rapat di mobile ──
  const weeklyInterval = isMobile
    ? Math.max(0, Math.floor(weekly.length / 6))
    : Math.max(0, Math.floor(weekly.length / 12));

  // ── Chart heights ──
  const weeklyChartH    = isMobile ? 140 : 180;
  const categoryChartH  = isMobile ? 140 : 160;

  // ── Tipe Pelanggan node ──
  const TipePelangganNode = (
    <Card
      theme={theme} title="Tipe Pelanggan"
      icon={<Users size={10} color="#f59e0b" />}
      color="#f59e0b" accent="#f59e0b"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center' }}>
        {typeCustomerBreakdown.length === 0 && (
          <span style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT_MONO, textAlign: 'center' }}>
            Tidak ada data
          </span>
        )}
        {typeCustomerBreakdown.slice(0, 6).map((k, i) => {
          const maxVal = Number(typeCustomerBreakdown[0]?.penjualan ?? 1) || 1;
          const pct    = (Number(k.penjualan ?? 0) / maxVal) * 100;
          const color  = CC[i % CC.length];
          return (
            <div key={k.type_customer} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: t.textSub, fontFamily: FONT_MONO }}>
                    {k.type_customer}
                  </span>
                  <span style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
                    ({Number(k.pct ?? 0).toFixed(1)}%)
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.text, fontFamily: FONT_MONO }}>
                  {fmtRpFull(Number(k.penjualan ?? 0))}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: t.borderCard, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  // ── Kategori node ──
  const KategoriNode = (
    <Card
      theme={theme} title="Penjualan per Kategori"
      icon={<Package size={10} color="#10b981" />}
      color="#10b981" accent="#10b981"
    >
      <ResponsiveContainer width="100%" height={categoryChartH}>
        <BarChart data={categories.slice(0, 8)} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
          <XAxis
            dataKey="kategori"
            tick={{ ...ts, fontSize: isMobile ? 7 : 8 }}
            axisLine={false} tickLine={false}
          />
          <YAxis tickFormatter={fmtRp} tick={ts} axisLine={false} tickLine={false} width={isMobile ? 44 : 60} />
          <Tooltip content={<ChartTooltip theme={theme} />} />
          <Bar dataKey="total_penjualan" name="Penjualan" radius={[2, 2, 0, 0]} maxBarSize={32}>
            {categories.slice(0, 8).map((_: any, i: number) =>
              <Cell key={i} fill={CC[i % CC.length]} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );

  // ── Customer table ──
  // Mobile: sembunyikan kolom Tipe, tampilkan hanya Pelanggan + Penjualan + Transaksi
  const CustomerTable = (
    <div style={{
      background: t.cardbg, border: `1px solid ${t.borderCard}`,
      borderRadius: 13, overflow: 'hidden', boxShadow: t.shadowCard,
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '8px 12px' : '10px 14px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 10,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: '#6366f115', border: '1px solid #6366f128',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={11} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>Data Pelanggan</div>
            <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO }}>
              {filteredCustomers.length} pelanggan
            </div>
          </div>
        </div>
        <input
          type="text"
          placeholder="Cari pelanggan…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            height: 26, padding: '0 10px', fontSize: 11, borderRadius: 7,
            background: t.inputBg, border: `1px solid ${t.borderInput}`,
            color: t.text, outline: 'none',
            width: isMobile ? '100%' : 180,
            fontFamily: FONT_MONO,
          }}
        />
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{
          minWidth: isMobile ? 320 : 500,
          width: '100%', borderCollapse: 'collapse', fontSize: 12,
        }}>
          <thead>
            <tr>
              <th style={{ ...thS, cursor: 'default' }}>Pelanggan</th>
              {/* Sembunyikan kolom Tipe di mobile */}
              {!isMobile && (
                <th style={{ ...thS, cursor: 'default' }}>Tipe</th>
              )}
              <th
                style={{ ...thS, textAlign: 'right' }}
                onClick={() => toggleSort('total_penjualan')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  Penjualan <SortIcon k="total_penjualan" />
                </span>
              </th>
              <th
                style={{ ...thS, textAlign: 'right' }}
                onClick={() => toggleSort('transaksi')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, float: 'right' }}>
                  {isMobile ? 'Trx' : 'Transaksi'} <SortIcon k="transaksi" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c, i) => (
              <tr
                key={`${c.pelanggan}-${i}`}
                style={{ background: i % 2 === 1 ? t.tableAlt : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? t.tableAlt : 'transparent')}
              >
                <td style={{
                  padding: isMobile ? '8px 8px' : '9px 10px',
                  color: t.text, fontFamily: FONT_MONO,
                  fontSize: isMobile ? 10 : 11,
                  maxWidth: isMobile ? 140 : 220,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {/* Mobile: tampilkan tipe sebagai sub-text */}
                  {isMobile ? (
                    <div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.pelanggan}
                      </div>
                      <div style={{ fontSize: 8, color: t.textMuted, marginTop: 1 }}>
                        {c.type_customer ?? '—'}
                      </div>
                    </div>
                  ) : c.pelanggan}
                </td>
                {!isMobile && (
                  <td style={{ padding: '9px 10px', fontSize: 10 }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 8, fontSize: 9,
                      fontWeight: 600, fontFamily: FONT_MONO,
                      background: t.infoBg, color: t.infoText, border: `1px solid ${t.infoBorder}`,
                    }}>
                      {c.type_customer ?? '—'}
                    </span>
                  </td>
                )}
                <td style={{
                  padding: isMobile ? '8px 8px' : '9px 10px',
                  textAlign: 'right', color: t.text,
                  fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11, fontWeight: 700,
                }}>
                  {fmtRpFull(Number(c.total_penjualan ?? 0))}
                </td>
                <td style={{
                  padding: isMobile ? '8px 8px' : '9px 10px',
                  textAlign: 'right', color: t.textMuted,
                  fontFamily: FONT_MONO, fontSize: isMobile ? 10 : 11,
                }}>
                  {Number(c.transaksi ?? 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={isMobile ? 3 : 4} style={{ padding: 32, textAlign: 'center', color: t.textMuted, fontSize: 12, fontFamily: FONT_MONO }}>
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  // MOBILE  (< 640px)
  // ══════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Weekly chart full width */}
        <Card
          theme={theme}
          title="Tren Penjualan Mingguan"
          icon={<Receipt size={10} color="#6366f1" />}
          color="#6366f1" accent="#6366f1"
          sub={`${weekly.length} minggu`}
        >
          <ResponsiveContainer width="100%" height={weeklyChartH}>
            <ComposedChart data={weekly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
              <XAxis
                dataKey="minggu"
                tickFormatter={v => `W${v}`}
                tick={{ ...ts, fontSize: 8 }} axisLine={false} tickLine={false}
                interval={weeklyInterval}
              />
              <YAxis tickFormatter={fmtRp} tick={{ ...ts, fontSize: 8 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip theme={theme} />} />
              <Bar dataKey="penjualan" name="Penjualan" fill="#6366f1" opacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={10} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Kategori + Tipe: 2 kolom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr ', gap: 10 }}>
          {KategoriNode}
          {TipePelangganNode}
        </div>

        {/* Customer table full width */}
        {CustomerTable}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // TABLET  (640–1023px)
  // ══════════════════════════════════════════
  if (isTablet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Weekly chart full width */}
        <Card
          theme={theme}
          title="Tren Penjualan Mingguan"
          icon={<Receipt size={10} color="#6366f1" />}
          color="#6366f1" accent="#6366f1"
          sub={`${weekly.length} minggu`}
        >
          <ResponsiveContainer width="100%" height={weeklyChartH}>
            <ComposedChart data={weekly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
              <XAxis
                dataKey="minggu"
                tickFormatter={v => `W${v}`}
                tick={ts} axisLine={false} tickLine={false}
                interval={weeklyInterval}
              />
              <YAxis tickFormatter={fmtRp} tick={ts} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip theme={theme} />} />
              <Bar dataKey="penjualan" name="Penjualan" fill="#6366f1" opacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={14} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Kategori (3/5) + Tipe Pelanggan (2/5) */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
          {KategoriNode}
          {TipePelangganNode}
        </div>

        {/* Customer table full width */}
        {CustomerTable}
      </div>
    );
  }

  // ══════════════════════════════════════════
  // DESKTOP  (≥ 1024px) — layout asli
  // ══════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card
        theme={theme}
        title="Tren Penjualan Mingguan"
        icon={<Receipt size={10} color="#6366f1" />}
        color="#6366f1" accent="#6366f1"
        sub={`${weekly.length} minggu`}
      >
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={weekly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gs} vertical={false} />
            <XAxis
              dataKey="minggu"
              tickFormatter={v => `W${v}`}
              tick={ts} axisLine={false} tickLine={false}
              interval={weeklyInterval}
            />
            <YAxis tickFormatter={fmtRp} tick={ts} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<ChartTooltip theme={theme} />} />
            <Bar dataKey="penjualan" name="Penjualan" fill="#6366f1" opacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={14} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        {KategoriNode}
        {TipePelangganNode}
      </div>

      {CustomerTable}
    </div>
  );
}