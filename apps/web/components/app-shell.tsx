'use client';

import { ReactNode, useState } from 'react';
import { Bell, CheckCircle2, Cuboid, FileText, Folder, Grid2X2, Layers3, LayoutDashboard, PanelTop, RotateCcw, Search, Settings2, SquareStack, Waypoints, ClipboardCheck, Boxes } from 'lucide-react';

export const NAV = [
  ['Overview', LayoutDashboard], ['Project', Folder], ['Canvas', Grid2X2], ['Layout', PanelTop],
  ['3D', Cuboid], ['Model', Boxes], ['Drawings', FileText], ['MEP', Waypoints],
  ['Materials', Layers3], ['BOQ', ClipboardCheck], ['Docs', SquareStack], ['Validate', CheckCircle2],
  ['Versions', RotateCcw], ['Integrations', Settings2]
] as const;

export function AppShell({ children, active='Layout', onNavigate }: { children: ReactNode; active?: string; onNavigate?: (label:string)=>void }) {
  const [current, setCurrent] = useState(active);
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">A</span><span>ARCHON</span></div>
      <nav className="topnav">{NAV.map(([label,Icon]) => <button key={label} className={current===label?'nav-item active':'nav-item'} onClick={()=>{setCurrent(label);onNavigate?.(label)}}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></button>)}</nav>
      <div className="top-actions"><div className="search"><Search size={17}/><span>Search...</span></div><button className="icon-button"><Bell size={18}/><i className="online-dot"/></button><div className="avatar">AD</div></div>
    </header>
    {children}
  </main>;
}
