'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, Cuboid, FileText, Folder, Grid2X2, Layers3, LayoutDashboard, PanelTop, RotateCcw, Search, Settings2, SquareStack, Waypoints, ClipboardCheck, Boxes, Menu, X, ChevronRight } from 'lucide-react';

export const NAV = [
  ['Overview','overview',LayoutDashboard], ['Project','project',Folder], ['Canvas','canvas',Grid2X2], ['Layout','layout',PanelTop],
  ['3D','3d',Cuboid], ['Model','model',Boxes], ['Drawings','drawings',FileText], ['MEP','mep',Waypoints],
  ['Materials','materials',Layers3], ['BOQ','boq',ClipboardCheck], ['Docs','docs',SquareStack], ['Validate','validate',CheckCircle2],
  ['Versions','versions',RotateCcw], ['Integrations','integrations',Settings2]
] as const;

export function AppShell({ children, active='layout' }: { children: ReactNode; active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = NAV.filter(([label]) => label.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { setMenuOpen(false); setNotificationsOpen(false); }, [active]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [menuOpen]);
  useEffect(() => { if (menuOpen) searchRef.current?.focus(); }, [menuOpen]);
  return <main className="app-shell">
    <header className="topbar">
      <Link href="/workspace/overview" className="brand" aria-label="ARCHON Overview"><span className="brand-mark">A</span><span>ARCHON</span></Link>
      <nav className="topnav" aria-label="ARCHON primary navigation">{NAV.map(([label,slug,Icon]) => <Link key={slug} href={`/workspace/${slug}`} aria-current={active===slug?'page':undefined} className={active===slug?'nav-item active':'nav-item'}><Icon size={19} strokeWidth={1.7}/><span>{label}</span></Link>)}</nav>
      <div className="top-actions">
        <button type="button" className="mobile-menu-toggle" aria-label="Open ARCHON navigation" aria-expanded={menuOpen} aria-controls="archon-mobile-drawer" onClick={() => setMenuOpen(true)}><Menu size={22}/><span>Menu</span></button>
        <button type="button" className="search archon-search-trigger" onClick={() => setMenuOpen(true)} aria-label="Search ARCHON modules"><Search size={17}/><span>Search modules...</span></button>
        <div className="notification-holder">
          <button type="button" className="icon-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(v=>!v)}><Bell size={18}/><i className="online-dot"/></button>
          {notificationsOpen && <div className="archon-notification-popup" role="status">No new notifications. Your Render standby is read-only.</div>}
        </div>
        <div className="avatar" aria-label="Account avatar">AD</div>
      </div>
    </header>
    {children}
    {menuOpen && <div className="archon-menu-layer" role="presentation">
      <button type="button" className="archon-menu-backdrop" aria-label="Close navigation" onClick={()=>setMenuOpen(false)} />
      <aside id="archon-mobile-drawer" className="archon-menu-drawer" role="dialog" aria-modal="true" aria-label="ARCHON navigation">
        <div className="archon-menu-heading"><strong>ARCHON <span>Workspace</span></strong><button type="button" aria-label="Close menu" onClick={()=>setMenuOpen(false)}><X size={22}/></button></div>
        <label className="archon-menu-search"><Search size={18}/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a module..." aria-label="Find a module"/></label>
        <nav className="archon-menu-links" aria-label="Mobile modules">{filtered.map(([label,slug,Icon]) => <Link key={slug} href={`/workspace/${slug}`} aria-current={active===slug?'page':undefined} className={active===slug?'active':''} onClick={()=>setMenuOpen(false)}><Icon size={20}/><span>{label}</span><ChevronRight size={17}/></Link>)}{filtered.length===0 && <p>No matching modules.</p>}</nav>
        <p className="archon-menu-footer">ARCHON Render standby · Read-only</p>
      </aside>
    </div>}
  </main>;
}
