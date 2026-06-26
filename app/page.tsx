'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TrendingUp, ShoppingCart, Receipt, AlertCircle, Upload, Layers,
  Sun, Moon, LogOut, ChevronLeft, BarChart3, Users, Settings, Package,
  ClipboardList,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Theme, tk, FONT_MONO, FONT_SANS } from '@/lib/theme';
import { DashboardData, FilterOptions } from '@/types/index';
import { Sel, Spinner } from '@/components/ui';
import OverviewTab from '@/components/OverviewTab';
import PenjualanTab from '@/components/PenjualanTab';
import SalesOrderTab from '@/components/SalesOrderTab';
import OutstandingTab from '@/components/OutstandingTab';
import UploadTabComp from '@/components/UploadTab';
import UserManagement from '@/components/UserManagement';
import SettingsTab from '@/components/SettingsTab';
import { apiJson } from '@/lib/apiFetch';
import KertasTab from '@/components/KertasTab';
import UploadKertasTab from '@/components/UploadKertasTab';
import WipTab from '@/components/PlanproduksiTab';
import UploadWIPTab from '@/components/UploadPlanTab';
import LhkpTab from '@/components/LhkpTab';
import UploadLhkpTab from '@/components/UploadLhkpTab';

const MONTHS = [{ value: 'all', label: 'Semua Bulan' }, ...['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map((l,i) => ({ value: String(i+1), label: l }))];

const ALL_TABS = [
  { id: 'overview',      label: 'Ringkasan',          shortLabel: 'Ringkasan',  Icon: TrendingUp,   roles: ['root','admin','user'] },
  { id: 'penjualan',     label: 'Penjualan',           shortLabel: 'Jual',       Icon: Receipt,      roles: ['root','admin','user'] },
  { id: 'so',            label: 'Sales Order',         shortLabel: 'SO',         Icon: ShoppingCart, roles: ['root','admin','user'] },
  { id: 'outstanding',   label: 'Outstanding',         shortLabel: 'Out.',       Icon: AlertCircle,  roles: ['root','admin','user'] },
  { id: 'kertas',        label: 'Stok Level',          shortLabel: 'Kertas',     Icon: Layers,       roles: ['root','admin','user'] },
  { id: 'Plan',          label: 'Plan Produksi',       shortLabel: 'Plan',       Icon: ClipboardList,roles: ['root','admin','user'] },
  { id: 'lhkp',          label: 'LHKP',                shortLabel: 'LHKP',       Icon: ClipboardList,roles: ['root','admin','user'] },
  { id: 'upload',        label: 'Upload Data',         shortLabel: 'Upload',     Icon: Upload,       roles: ['root','admin'] },
  { id: 'kertas_upload', label: 'Upload Stok Kertas',  shortLabel: 'Up. Kertas', Icon: Package,      roles: ['root','admin'] },
  { id: 'Plan_upload',   label: 'Upload Plan Produksi',shortLabel: 'Up. Plan',   Icon: Package,      roles: ['root','admin'] },
  { id: 'lhkp_upload',   label: 'Upload LHKP',         shortLabel: 'Up. LHKP',  Icon: Package,      roles: ['root','admin'] },
  { id: 'users',         label: 'Manajemen User',      shortLabel: 'User',       Icon: Users,        roles: ['root'] },
  // { id: 'settings',      label: 'Pengaturan',          shortLabel: 'Setting',    Icon: Settings,     roles: ['root'] },
] as const;
type TabId = typeof ALL_TABS[number]['id'];

const EMPTY: DashboardData = {
  summary: {
    total_penjualan:   0,
    total_so:          0,
    total_outstanding: 0,
    total_terkirim:    0,
    qty_penjualan:     0,
    qty_so:            0,
    transaksi:         0,
    pct_outstanding:   0,
  },
  monthly:               [],
  weekly:                [],
  categories:            [],
  topCustomers:          [],
  topProducts:           [],
  typeCustomerBreakdown: [],
  jenisBreakdown:        [],  
  keteranganBreakdown:   [],
  topOutstanding:        [],
  allYears:              [],
};

function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile:false, isTablet:false });
  useEffect(() => {
    const u = () => { const w=window.innerWidth; setBp({ isMobile:w<768, isTablet:w>=768&&w<1024 }); };
    u(); window.addEventListener('resize',u); return ()=>window.removeEventListener('resize',u);
  }, []);
  return bp;
}

function ThemeToggle({ theme, setTheme, compact }: { theme:Theme; setTheme:(t:Theme)=>void; compact?:boolean }) {
  const t=tk[theme]; const isDark=theme==='dark';
  if (compact) return (
    <button onClick={()=>setTheme(isDark?'light':'dark')} style={{width:30,height:30,borderRadius:7,background:t.toggleBg,border:`1px solid ${t.toggleBorder}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:t.textMuted}}>
      {isDark?<Sun size={13}/>:<Moon size={13}/>}
    </button>
  );
  return (
    <button onClick={()=>setTheme(isDark?'light':'dark')} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 8px 3px 4px',background:t.toggleBg,border:`1px solid ${t.toggleBorder}`,borderRadius:16,cursor:'pointer'}}>
      <span style={{position:'relative',display:'inline-flex',width:26,height:15,borderRadius:8,background:isDark?'#1e2060':'#e8f0fe'}}>
        <span style={{position:'absolute',top:3,left:isDark?14:3,width:9,height:9,borderRadius:'50%',background:isDark?'#818cf8':'#2563eb',transition:'left 0.2s'}}/>
      </span>
      <span style={{fontSize:10,fontWeight:600,color:t.textSub,fontFamily:FONT_MONO}}>{isDark?'Dark':'Light'}</span>
    </button>
  );
}

function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, theme, setTheme, userRole }: {
  activeTab:TabId; setActiveTab:(id:TabId)=>void;
  collapsed:boolean; setCollapsed:(v:boolean)=>void;
  theme:Theme; setTheme:(t:Theme)=>void; userRole: string;
}) {
  const t=tk[theme]; const {user,logout}=useAuth();
  const tabs = ALL_TABS.filter(tab => tab.roles.includes(userRole as any));
  return (
    <aside style={{position:'fixed',left:0,top:0,height:'100vh',zIndex:40,display:'flex',flexDirection:'column',width:collapsed?52:210,background:t.sidebarbg,borderRight:`1px solid ${t.border}`,transition:'width 0.2s cubic-bezier(.4,0,.2,1)',overflowX:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:collapsed?'center':'space-between',padding:collapsed?'0':'0 8px 0 12px',borderBottom:`1px solid ${t.border}`,flexShrink:0,minHeight:48}}>
        {collapsed?(
          <button onClick={() => setCollapsed(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
            <img src="/logo-s3.jpeg" alt="S3" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain' }}/>
          </button>
        ):(
          <>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <img src="/logo-s3.jpeg" alt="S3" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain' }}/>
              <div>
                <div style={{color:t.text,fontSize:12,fontWeight:800,fontFamily:FONT_MONO,lineHeight:1.15,letterSpacing:'-0.02em'}}>SSS</div>
                <div style={{color:t.textMuted,fontSize:8,fontFamily:FONT_MONO,letterSpacing:'0.1em',textTransform:'uppercase'}}>SO & OS Dashboard</div>
              </div>
            </div>
            <button onClick={()=>setCollapsed(true)} style={{background:t.inputBg,border:`1px solid ${t.borderInput}`,cursor:'pointer',color:t.textMuted,borderRadius:6,width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <ChevronLeft size={11}/>
            </button>
          </>
        )}
      </div>

      <nav style={{flex:1,padding:'8px 4px',overflowY:'auto'}}>
        {tabs.map((tab, idx) => {
          const { id, label, Icon } = tab;
          const active = activeTab === id;
          const prevTab = tabs[idx - 1];
          const showDivider = !collapsed && prevTab && (
            (id === 'upload' && !['upload'].includes(prevTab.id)) 
            // (id === 'settings' && !['settings'].includes(prevTab.id) && prevTab.id !== 'users')
          );
          return (
            <React.Fragment key={id}>
              {showDivider && (
                <div style={{margin:'6px 8px',borderTop:`1px solid ${t.border}`}}/>
              )}
              <button onClick={()=>setActiveTab(id)} title={collapsed?label:undefined}
                style={{display:'flex',alignItems:'center',gap:8,width:'100%',minHeight:35,padding:collapsed?'5px 0':'6px 9px',borderRadius:8,border:'none',cursor:'pointer',justifyContent:collapsed?'center':'flex-start',background:active?t.navActiveBg:'transparent',color:active?t.navActiveText:t.textNav,fontSize:12,fontWeight:active?600:400,fontFamily:FONT_SANS,transition:'all 0.12s',marginBottom:1,position:'relative'}}>
                <Icon size={14} color={active?t.navActiveText:t.textMuted}/>
                {!collapsed&&<span style={{flex:1,textAlign:'left'}}>{label}</span>}
                {active&&<span style={{position:'absolute',left:0,top:'22%',bottom:'22%',width:2.5,borderRadius:'0 2px 2px 0',background:t.navActiveDot}}/>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div style={{padding:collapsed?'8px 4px':'8px',borderTop:`1px solid ${t.border}`,flexShrink:0,display:'flex',flexDirection:'column',gap:6,alignItems:collapsed?'center':'stretch'}}>
        {collapsed?(
          <>
            <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{background:'none',border:'none',cursor:'pointer',color:t.textMuted,borderRadius:7,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center'}}>{theme==='dark'?<Sun size={13}/>:<Moon size={13}/>}</button>
            <button onClick={logout} style={{background:t.red.bg,border:`1px solid ${t.red.border}`,cursor:'pointer',borderRadius:7,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center'}}><LogOut size={12} color={t.red.text}/></button>
          </>
        ):(
          <>
            {user&&(
              <div style={{padding:'7px 9px',borderRadius:9,background:t.inputBg,border:`1px solid ${t.borderInput}`,display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:26,height:26,borderRadius:7,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12,fontWeight:800,color:'#818cf8',fontFamily:FONT_MONO}}>{user.username[0].toUpperCase()}</div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:t.text,fontFamily:FONT_MONO,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.username}</div>
                  <div style={{fontSize:8,color:t.textMuted,fontFamily:FONT_MONO,textTransform:'uppercase',letterSpacing:'0.09em'}}>{user.role}</div>
                </div>
                <button onClick={logout} style={{background:t.red.bg,border:`1px solid ${t.red.border}`,cursor:'pointer',borderRadius:5,width:22,height:22,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><LogOut size={10} color={t.red.text}/></button>
              </div>
            )}
            <ThemeToggle theme={theme} setTheme={setTheme}/>
          </>
        )}
      </div>
    </aside>
  );
}

function MobileHeader({ theme, setTheme }: { theme:Theme; setTheme:(t:Theme)=>void }) {
  const t=tk[theme]; const {user,logout}=useAuth();
  return (
    <header style={{background:t.headerbg,backdropFilter:'blur(12px)',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',height:46,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <img src="/logo-s3.jpeg" alt="S3" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain' }}/>
        <span style={{fontSize:13,fontWeight:800,color:t.text,fontFamily:FONT_MONO,letterSpacing:'-0.02em'}}>SO Dashboard</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:5}}>
        {user&&<span style={{fontSize:10,fontWeight:600,color:t.textSub,fontFamily:FONT_MONO,padding:'2px 7px',borderRadius:10,background:t.inputBg,border:`1px solid ${t.borderInput}`}}>{user.username}</span>}
        <ThemeToggle theme={theme} setTheme={setTheme} compact/>
        <button onClick={logout} style={{width:30,height:30,borderRadius:8,background:t.red.bg,border:`1px solid ${t.red.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><LogOut size={12} color={t.red.text}/></button>
      </div>
    </header>
  );
}

function MobileBottomNav({ activeTab, setActiveTab, theme, userRole }: { activeTab:TabId; setActiveTab:(id:TabId)=>void; theme:Theme; userRole:string }) {
  const t=tk[theme];
  const tabs = ALL_TABS.filter(tab => tab.roles.includes(userRole as any));
  return (
    <nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:9999,background:t.bottombarbg,backdropFilter:'blur(16px)',borderTop:`1px solid ${t.border}`,display:'flex',paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
      {tabs.map(({id,shortLabel,Icon}) => {
        const active=activeTab===id;
        return (
          <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'7px 1px',border:'none',background:'transparent',cursor:'pointer',minHeight:50,gap:2,color:active?t.navActiveText:t.textMuted,position:'relative'}}>
            <Icon size={16} color={active?t.navActiveText:t.textMuted}/>
            <span style={{fontSize:8,fontWeight:active?700:400,fontFamily:FONT_SANS,lineHeight:1}}>{shortLabel}</span>
            {active&&<span style={{position:'absolute',top:0,width:18,height:2.5,background:t.navActiveText,borderRadius:'0 0 2px 2px'}}/>}
          </button>
        );
      })}
    </nav>
  );
}

type FilterState = { tahun:string; bulan:string; minggu:string; area:string; type_customer:string; kategori:string; jenis:string };

const FILTER_INIT: FilterState = {
  tahun: 'all', bulan: 'all', minggu: 'all',
  area: 'all', type_customer: 'all', kategori: 'all', jenis: 'all',
};

function FilterBar({ filters, setFilters, appliedFilters, opts, onApply, onReset, loading, theme }: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  appliedFilters: FilterState;
  opts: FilterOptions;
  onApply: () => void;
  onReset: () => void;
  loading: boolean;
  theme: Theme;
}) {
  const t=tk[theme];

  // dirty: filter draft berbeda dari yang sudah applied
  const dirty = (Object.keys(filters) as (keyof FilterState)[]).some(
    k => filters[k] !== appliedFilters[k]
  );

  const WEEKS=[{value:'all',label:'Semua Minggu'},...Array.from({length:52},(_,i)=>({value:String(i+1),label:`W${i+1}`}))];
  const YEARS=[{value:'all',label:'Semua Tahun'},...opts.years.map(y=>({value:String(y),label:String(y)}))];
  const TYPES=[{value:'all',label:'Semua Tipe'},...opts.typeCustomers.map(a=>({value:a,label:a}))];
  const KATS=[{value:'all',label:'Semua Kategori'},...opts.kategoris.map(a=>({value:a,label:a}))];
  const JENS=[{value:'all', label:'Semua Jenis'},...opts.jenis.map(a=>({value:a, label:a}))];

  return (
    <div style={{flexShrink:0,background:t.filterbg,borderBottom:`1px solid ${t.border}`}}>
      <div style={{display:'flex',alignItems:'center',padding:'0 14px',height:36,gap:5,overflowX:'auto',scrollbarWidth:'none'}}>
        <Sel value={filters.tahun} onChange={v=>setFilters(f=>({...f,tahun:v}))} options={YEARS} theme={theme} style={{minWidth:86}}/>
        <Sel value={filters.bulan} onChange={v=>setFilters(f=>({...f,bulan:v}))} options={MONTHS} theme={theme} style={{minWidth:78}}/>
        <Sel value={filters.minggu} onChange={v=>setFilters(f=>({...f,minggu:v}))} options={WEEKS} theme={theme} style={{minWidth:70}}/>
        <div style={{width:1,height:12,background:t.border,flexShrink:0,margin:'0 1px'}}/>
        <Sel value={filters.type_customer} onChange={v=>setFilters(f=>({...f,type_customer:v}))} options={TYPES} theme={theme} style={{minWidth:90}}/>
        <Sel value={filters.kategori} onChange={v=>setFilters(f=>({...f,kategori:v}))} options={KATS} theme={theme} style={{minWidth:110}}/>
        <Sel value={filters.jenis} onChange={v=>setFilters(f=>({...f,jenis:v}))} options={JENS} theme={theme} style={{minWidth:90}} />
        <div style={{flex:1}}/>
        {loading&&<Spinner size={11} color="#818cf8"/>}
        {/* indikator ada filter belum diterapkan */}
        {dirty&&(
          <span style={{fontSize:9,fontFamily:FONT_MONO,color:'#f59e0b',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:4,padding:'1px 6px',flexShrink:0}}>
            belum diterapkan
          </span>
        )}
        {(dirty || (Object.keys(appliedFilters) as (keyof FilterState)[]).some(k => appliedFilters[k] !== 'all')) && (
          <button onClick={onReset} style={{height:22,padding:'0 8px',borderRadius:5,fontSize:10,fontFamily:FONT_MONO,background:'transparent',border:`1px solid ${t.borderInput}`,color:t.textMuted,cursor:'pointer',flexShrink:0}}>Reset</button>
        )}
        <button
          onClick={onApply}
          disabled={loading}
          style={{
            height:22,padding:'0 12px',borderRadius:5,fontSize:10,fontWeight:700,fontFamily:FONT_MONO,
            background: dirty ? '#f59e0b' : '#6366f1',
            border:'none',color:'#fff',cursor:loading?'not-allowed':'pointer',
            opacity:loading?0.5:1,flexShrink:0,
            boxShadow: dirty ? '0 1px 6px rgba(245,158,11,0.4)' : '0 1px 6px rgba(99,102,241,0.35)',
            transition:'background 0.15s, box-shadow 0.15s',
          }}
        >
          Terapkan
        </button>
      </div>
    </div>
  );
}

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [dots, setDots] = useState(0);

  useEffect(() => { const iv = setInterval(() => setDots(d => (d + 1) % 4), 500); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!loading && !user) window.location.href = '/login?from=' + encodeURIComponent(window.location.pathname); }, [user, loading]);

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: '#07090e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'IBM Plex Mono, monospace' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        @keyframes sgPulse { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
        @keyframes sgRing  { to{transform:rotate(360deg)} }
        @keyframes sgFadeUp{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sgBar   { 0%{width:0%} 40%{width:60%} 70%{width:82%} 100%{width:96%} }
      `}</style>
      <div style={{ animation: 'sgFadeUp 0.5s ease both', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <svg style={{ position: 'absolute', inset: 0, animation: 'sgRing 1.4s linear infinite' }} width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="rgba(151, 6, 6, 0.15)" strokeWidth="2.5"/>
            <path d="M32 4 a28 28 0 0 1 24.2 14" stroke="#970617" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div style={{ position: 'absolute', inset: 10, borderRadius: 12, background: 'rgba(28,151,6,0.12)', border: '1px solid rgba(28,151,6,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'sgPulse 2s ease-in-out infinite' }}>
            <img src="/logo-s3.jpeg" alt="S3" style={{ width: 28, height: 28, objectFit: 'contain' }}/>
          </div>
        </div>
        <div style={{ textAlign: 'center', animation: 'sgFadeUp 0.5s 0.1s ease both', opacity: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.03em', lineHeight: 1 }}>SSS</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 4 }}>Dashboard</div>
        </div>
        <div style={{ animation: 'sgFadeUp 0.5s 0.2s ease both', opacity: 0, width: 160 }}>
          <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #979206, #4a4ade)', borderRadius: 2, animation: 'sgBar 2.5s cubic-bezier(0.4,0,0.2,1) forwards' }}/>
          </div>
        </div>
        <div style={{ animation: 'sgFadeUp 0.5s 0.3s ease both', opacity: 0, fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.06em' }}>
          Memverifikasi sesi{'.' .repeat(dots)}
        </div>
      </div>
    </div>
  );
  return <>{children}</>;
}

const DATA_TABS: TabId[] = ['overview','penjualan','so','outstanding'];

function DashboardInner() {
  const [theme,setTheme]=useState<Theme>('dark');
  const [tab,setTab]=useState<TabId>('overview');
  const [collapsed,setCollapsed]=useState(false);
  const {isMobile,isTablet}=useBreakpoint();
  const {user}=useAuth();

  // filters: draft (diubah real-time oleh user)
  const [filters,setFilters]=useState<FilterState>(FILTER_INIT);
  // appliedFilters: hanya berubah setelah tombol Terapkan diklik
  const [appliedFilters,setAppliedFilters]=useState<FilterState>(FILTER_INIT);

  const [opts,setOpts]=useState<FilterOptions>({years:[],months:[],areas:[],typeCustomers:[],kategoris:[],keterangans:[], jenis:[]});
  const [data,setData]=useState<DashboardData>(EMPTY);
  const [loading,setLoading]=useState(false);
  const [availH,setAvailH]=useState(600);
  const mainRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ try { const s=localStorage.getItem('so-theme') as Theme; if(s==='dark'||s==='light')setTheme(s); } catch{} },[]);
  const applyTheme=(v:Theme)=>{ setTheme(v); try { localStorage.setItem('so-theme',v); } catch{} };

  useEffect(()=>{ if(isTablet) setCollapsed(true); },[isTablet]);

  useEffect(()=>{
    const m=()=>{ if(mainRef.current) setAvailH(mainRef.current.clientHeight); };
    m();
    const ro=new ResizeObserver(m);
    if(mainRef.current) ro.observe(mainRef.current);
    return ()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    apiJson('/api/sales/filters').then(j=>{ if(j.success) setOpts(j.data); }).catch(()=>{});
  },[]);

  const doApply=useCallback(async()=>{
    setLoading(true);
    try {
      const p=new URLSearchParams();
      if(filters.tahun!=='all') p.set('tahun',filters.tahun);
      if(filters.bulan!=='all') p.set('bulan',filters.bulan);
      if(filters.minggu!=='all') p.set('minggu',filters.minggu);
      if(filters.area!=='all') p.set('area',filters.area);
      if(filters.type_customer!=='all') p.set('type_customer',filters.type_customer);
      if(filters.kategori!=='all') p.set('kategori',filters.kategori);
      if(filters.jenis!=='all') p.set('jenis', filters.jenis);
      const r=await apiJson(`/api/sales?${p}`);
      if(r.success) {
        setData(r.data);
        setAppliedFilters({ ...filters }); // ← simpan sebagai applied hanya setelah berhasil
      }
      console.log('doApply filters:', filters);
console.log('query string:', `/api/sales?${p}`);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  },[filters]);

  const doReset=()=>{
    setFilters(FILTER_INIT);
    setAppliedFilters(FILTER_INIT);
    setData(EMPTY);
  };

  const sideW=isMobile?0:collapsed?52:210;
  const pad=isMobile?10:12;
  const userRole=user?.role||'user';
  const t=tk[theme];
  const showFilter=DATA_TABS.includes(tab);

  // gunakan appliedFilters untuk export/settings
  const filtersForExport = Object.fromEntries(Object.entries(appliedFilters));

  const renderTab=()=>{
    switch(tab){
      case 'penjualan':     return <PenjualanTab data={data} theme={theme}/>;
      // ↓ pakai appliedFilters.tahun bukan filters.tahun
      case 'so':            return <SalesOrderTab data={data} theme={theme} tahun={appliedFilters.tahun}/>;
      case 'outstanding':   return <OutstandingTab data={data} theme={theme} tahun={appliedFilters.tahun} />;
      case 'lhkp':          return <LhkpTab theme={theme}/>;
      case 'lhkp_upload':   return userRole!=='user'?<UploadLhkpTab theme={theme}/>:null;
      case 'upload':        return userRole!=='user'?<UploadTabComp theme={theme}/>:null;
      case 'kertas_upload': return userRole!=='user'?<UploadKertasTab theme={theme}/>:null;
      case 'Plan_upload':   return userRole!=='user'?<UploadWIPTab theme={theme}/>:null;
      case 'users':         return userRole!=='user'?<UserManagement theme={theme}/>:null;
      case 'kertas':        return <KertasTab theme={theme}/>;
      case 'Plan':          return <WipTab theme={theme}/>;
      // case 'settings':      return <SettingsTab theme={theme} currentFilters={filtersForExport}/>;
      default:              return <OverviewTab data={data} theme={theme} availH={availH}/>;
    }
  };

  return (
    <div style={{width:'100%',background:t.pagebg,fontFamily:FONT_SANS,height:'100vh',display:'flex',position:'relative',overflow:'hidden'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        html,body{margin:0;padding:0;height:100%}
        body{overflow:hidden}
        *,*::before,*::after{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.22);border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(99,102,241,0.38)}
        button{-webkit-tap-highlight-color:transparent}
        select:focus{outline:2px solid rgba(99,102,241,0.4);outline-offset:1px}
      `}</style>

      {!isMobile && (
        <Sidebar
          activeTab={tab} setActiveTab={setTab}
          collapsed={collapsed} setCollapsed={setCollapsed}
          theme={theme} setTheme={applyTheme}
          userRole={userRole}
        />
      )}

      <div style={{marginLeft:sideW,display:'flex',flexDirection:'column',height:'100vh',flex:1,transition:isMobile?'none':'margin-left 0.2s cubic-bezier(.4,0,.2,1)',overflow:'hidden',minWidth:0}}>
        {isMobile && <MobileHeader theme={theme} setTheme={applyTheme}/>}

        {showFilter && (
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            appliedFilters={appliedFilters}
            opts={opts}
            onApply={doApply}
            onReset={doReset}
            loading={loading}
            theme={theme}
          />
        )}

        <main ref={mainRef} style={{
          flex:1, minHeight:0, padding:pad,
          paddingBottom:isMobile?`calc(50px + env(safe-area-inset-bottom,0px) + ${pad}px)`:`${pad}px`,
          background:t.contentBg,
          overflow:tab==='overview'&&!isMobile?'hidden':'auto',
        }}>
          {renderTab()}
        </main>
      </div>

      {isMobile && (
        <MobileBottomNav activeTab={tab} setActiveTab={setTab} theme={theme} userRole={userRole}/>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthProvider>
      <SessionGuard>
        <DashboardInner/>
      </SessionGuard>
    </AuthProvider>
  );
}