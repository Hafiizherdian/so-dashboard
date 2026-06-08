export type Theme = 'dark' | 'light';

export const tk = {
  dark: {
    pagebg: '#07090e',
    sidebarbg: '#0b0d13',
    headerbg: 'rgba(11,13,19,0.96)',
    filterbg: '#0b0d13',
    cardbg: '#0e1118',
    bottombarbg: 'rgba(11,13,19,0.97)',
    border: 'rgba(255,255,255,0.055)',
    borderCard: 'rgba(255,255,255,0.075)',
    borderInput: 'rgba(255,255,255,0.09)',
    text: 'rgba(255,255,255,0.92)',
    textSub: 'rgba(255,255,255,0.52)',
    textMuted: 'rgba(255,255,255,0.28)',
    textFaint: 'rgba(255,255,255,0.13)',
    textNav: 'rgba(255,255,255,0.36)',
    navActiveBg: 'rgba(28,151,6,0.11)',
    navActiveText: '#4ade80',
    navActiveDot: '#1c9706',
    inputBg: 'rgba(255,255,255,0.035)',
    toggleBg: 'rgba(255,255,255,0.055)',
    toggleBorder: 'rgba(255,255,255,0.09)',
    optionBg: '#0b0d13',
    scrollbar: 'rgba(255,255,255,0.08)',
    // KPI cards
    card1bg: '#0d1028', card1border: '#1e2460', card1text: '#818cf8', card1accent: '#6366f1',
    card2bg: '#0a1a14', card2border: '#1a4030', card2text: '#6ee7b7', card2accent: '#10b981',
    card3bg: '#1a1108', card3border: '#3d2b08', card3text: '#fcd34d', card3accent: '#f59e0b',
    card4bg: '#1a080d', card4border: '#3d1220', card4text: '#fca5a5', card4accent: '#ef4444',
    // Status
    posBg: 'rgba(16,185,129,0.1)',   posText: '#6ee7b7', posBorder: 'rgba(16,185,129,0.25)',
    negBg: 'rgba(239,68,68,0.08)',   negText: '#fca5a5', negBorder: 'rgba(239,68,68,0.18)',
    warnBg: 'rgba(245,158,11,0.1)',  warnText: '#fcd34d', warnBorder: 'rgba(245,158,11,0.28)',
    infoBg: 'rgba(99,102,241,0.12)', infoText: '#a5b4fc', infoBorder: 'rgba(99,102,241,0.3)',
    red: { bg: 'rgba(239,68,68,0.08)', text: '#fca5a5', border: 'rgba(239,68,68,0.18)' },
    // Chart
    gridStroke: 'rgba(255,255,255,0.04)',
    tooltipBg: '#13161f',
    tooltipBorder: 'rgba(255,255,255,0.09)',
    tableHead: '#111318',
    tableAlt: '#0f1117',
    rowHover: 'rgba(28,151,6,0.08)',
    shadowCard: '0 4px 20px rgba(0,0,0,0.4)',
    contentBg: '#07090e',
  },
  light: {
    pagebg: '#eef1f7',
    sidebarbg: '#ffffff',
    headerbg: 'rgba(255,255,255,0.96)',
    filterbg: '#ffffff',
    cardbg: '#ffffff',
    bottombarbg: 'rgba(255,255,255,0.97)',
    border: 'rgba(0,0,0,0.065)',
    borderCard: 'rgba(0,0,0,0.08)',
    borderInput: 'rgba(0,0,0,0.1)',
    text: '#0f172a',
    textSub: '#475569',
    textMuted: '#94a3b8',
    textFaint: '#cbd5e1',
    textNav: '#64748b',
    navActiveBg: 'rgba(28,151,6,0.07)',
    navActiveText: '#15803d',
    navActiveDot: '#1c9706',
    inputBg: 'rgba(0,0,0,0.03)',
    toggleBg: '#f1f5f9',
    toggleBorder: 'rgba(0,0,0,0.09)',
    optionBg: '#ffffff',
    scrollbar: 'rgba(0,0,0,0.12)',
    card1bg: '#eff0ff', card1border: '#c7d2fe', card1text: '#4f46e5', card1accent: '#6366f1',
    card2bg: '#f0fdf4', card2border: '#bbf7d0', card2text: '#15803d', card2accent: '#10b981',
    card3bg: '#fefce8', card3border: '#fde68a', card3text: '#92400e', card3accent: '#f59e0b',
    card4bg: '#fff1f2', card4border: '#fecdd3', card4text: '#be123c', card4accent: '#ef4444',
    posBg: '#f0fdf4', posText: '#16a34a', posBorder: '#bbf7d0',
    negBg: '#fef2f2', negText: '#b91c1c', negBorder: '#fecaca',
    warnBg: '#fffbeb', warnText: '#d97706', warnBorder: '#fde68a',
    infoBg: 'rgba(99,102,241,0.08)', infoText: '#4f46e5', infoBorder: 'rgba(99,102,241,0.2)',
    red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    gridStroke: 'rgba(0,0,0,0.045)',
    tooltipBg: '#ffffff',
    tooltipBorder: 'rgba(0,0,0,0.1)',
    tableHead: '#f8fafc',
    tableAlt: '#f1f5f9',
    rowHover: 'rgba(28,151,6,0.05)',
    shadowCard: '0 2px 10px rgba(0,0,0,0.07)',
    contentBg: '#eef1f7',
  },
} as const;

export type Tokens = typeof tk['dark'];

export const CC = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0d9488','#f97316','#ec4899','#3b82f6','#84cc16'];

export const fmtRp = (v: number): string => {
  if (v >= 1e9) return `Rp ${(v/1e9).toFixed(1)}M`;
  if (v >= 1e6) return `Rp ${(v/1e6).toFixed(1)}jt`;
  if (v >= 1e3) return `Rp ${(v/1e3).toFixed(0)}rb`;
  return `Rp ${Math.round(v).toLocaleString('id-ID')}`;
};

export const fmtRpFull = (v: number): string =>
  `Rp ${Math.round(v).toLocaleString('id-ID')}`;

export const fmtNum = (v: number): string => {
  if (v >= 1e6) return `${(v/1e6).toFixed(1)}jt`;
  if (v >= 1e3) return `${(v/1e3).toFixed(0)}rb`;
  return Math.round(v).toLocaleString('id-ID');
};

export const FONT_MONO = '"IBM Plex Mono", monospace';
export const FONT_SANS = '"IBM Plex Sans", sans-serif';