'use client';
import React from 'react';
import { tk, Theme, Tokens, FONT_MONO, FONT_SANS, fmtRp, fmtRpFull } from '@/lib/theme';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg style={{ animation: 'spin 0.8s linear infinite', width: size, height: size, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" opacity="0.2" />
      <path d="M4 12a8 8 0 018-8" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Chart Tooltip ──────────────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label, theme, currency = true }: any) {
  const t = tk[theme as Theme];
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => currency ? fmtRpFull(v) : v.toLocaleString('id-ID');
  return (
    <div style={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 9, padding: '8px 12px', fontSize: 11, fontFamily: FONT_MONO, boxShadow: '0 6px 24px rgba(0,0,0,0.28)' }}>
      {label && <div style={{ color: t.textMuted, marginBottom: 5, fontSize: 10 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: i < payload.length - 1 ? 3 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ color: t.textSub, flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: t.text }}>{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
interface KpiCardProps {
  bg: string; border: string; labelColor: string; accent: string;
  label: string; value: string; sub?: string;
  badge?: { text: string; positive: boolean };
  theme: Theme;
  icon?: React.ReactNode;
}
export function KpiCard({ bg, border, labelColor, accent, label, value, sub, badge, theme, icon }: KpiCardProps) {
  const t = tk[theme];
  return (
    <div style={{ borderRadius: 13, padding: '14px 16px 12px', background: bg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: `${accent}14`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 9, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: '0.1em', color: labelColor, fontWeight: 700 }}>{label}</div>
        {icon && <div style={{ color: labelColor, opacity: 0.7 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontFamily: FONT_MONO, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: t.textMuted, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      {badge && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 10, width: 'fit-content', fontSize: 9, fontWeight: 700, fontFamily: FONT_MONO, background: badge.positive ? t.posBg : t.negBg, color: badge.positive ? t.posText : t.negText, border: `1px solid ${badge.positive ? t.posBorder : t.negBorder}` }}>
          {badge.positive ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
          {badge.text}
        </span>
      )}
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, theme, title, icon, color, sub, style, accent }: {
  children: React.ReactNode; theme: Theme;
  title?: string; icon?: React.ReactNode; color?: string; sub?: string;
  style?: React.CSSProperties; accent?: string;
}) {
  const t = tk[theme];
  return (
    <div style={{ background: t.cardbg, border: `1px solid ${t.borderCard}`, borderRadius: 13, padding: '10px 12px 10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: t.shadowCard, position: 'relative', ...style }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: '0 0 2px 2px', background: `linear-gradient(90deg,${accent}66,${accent}22)` }} />}
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexShrink: 0 }}>
          {icon && color && (
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}15`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: FONT_SANS, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {sub && <div style={{ fontSize: 9, color: t.textMuted, fontFamily: FONT_MONO, marginTop: 1 }}>{sub}</div>}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

// ─── Select ─────────────────────────────────────────────────────────────────
export function Sel({ value, onChange, options, theme, style }: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  theme: Theme;
  style?: React.CSSProperties;
}) {
  const t = tk[theme];
  const arrow = theme === 'light' ? '%23555' : '%23aaa';
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        height: 26, padding: '0 22px 0 8px',
        backgroundColor: t.inputBg,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${arrow}' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
        border: `1px solid ${t.borderInput}`, borderRadius: 6,
        color: t.text, fontSize: 11, fontFamily: FONT_MONO,
        cursor: 'pointer', outline: 'none', appearance: 'none',
        ...style,
      }}
    >
      {options.map(o => (
        <option key={String(o.value)} value={o.value} style={{ background: t.optionBg, color: t.text }}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────
export function ProgressBar({ pct, color, bg, height = 4 }: { pct: number; color: string; bg: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: bg, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: height, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ─── Tick style helper ──────────────────────────────────────────────────────
export const mkTick = (theme: Theme) => ({ fontSize: 9, fill: tk[theme].textMuted, fontFamily: FONT_MONO });
