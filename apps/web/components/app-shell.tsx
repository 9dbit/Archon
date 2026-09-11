'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Bell, CheckCircle2, Cuboid, FileText, Folder, Grid2X2, Layers3, LayoutDashboard, PanelTop, RotateCcw, Search, Settings2, SquareStack, Waypoints, ClipboardCheck, Boxes } from 'lucide-react';

export const NAV = [
  ['Overview','overview',LayoutDashboard], ['Project','project',Folder], ['Canvas','canvas',Grid2X2], ['Layout','layout',PanelTop],
  ['3D','3d',Cuboid], ['Model','model',Boxes], ['Drawings','drawings',FileText], ['MEP','mep',Waypoints],
  ['Materials','materials',Layers3], ['BOQ','boq',ClipboardCheck], ['Docs','docs',SquareStack], ['Validate','validate',CheckCircle2],
  ['Versions','versions',RotateCcw], ['Integrations','integrations',Settings2]
] as const;

export function AppShell({ children, active='layout' }: { children: ReactNode; active?: string }) {
  return <main className="app-shell">
    <header className="topbar">
      <Link href="/workspace/overview" className="brand"><span className="brand-mark">A</span><span>ARCHON</span></Link>
      <nav className="topnav">{NAV.map(([label,slug,Icon]) => <Link key={slug} href={`/workspace/${slug}`} className={active===slug?'nav-item active':'nav-item'}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></Link>)}</nav>
      <div className="top-actions"><div className="search"><Search size={17}/><span>Search...</span></div><button className="icon-button"><Bell size={18}/><i className="online-dot"/></button><div className="avatar">AD</div></div>
    </header>
    {children}
  </main>;
}
