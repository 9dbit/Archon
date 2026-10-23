'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, Cuboid, Menu, Settings2, X } from 'lucide-react';

const advanced = [
  { label: 'Layout legacy', href: '/workspace/layout' },
  { label: '3D Graph legacy', href: '/workspace/3d' },
  { label: 'Drawings legacy', href: '/workspace/drawings' },
  { label: 'Version history', href: '/workspace/versions' }
];

export function AppShell({ children, active = 'revit' }: { children: ReactNode; active?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [active]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return <main className="rw-app">
    <header className="rw-header">
      <Link href="/workspace/revit" className="rw-logo" aria-label="ARCHON home">
        <span className="rw-logomark">A</span>
        <span className="rw-wordmark">ARCHON<small>AI ARCHITECTURE</small></span>
      </Link>
      <nav className="rw-primary-nav" aria-label="Main navigation">
        <Link href="/workspace/revit" className={active === 'revit' ? 'rw-nav-link is-active' : 'rw-nav-link'}>
          <Cuboid size={17}/> Revit Workspace
        </Link>
        <Link href="/workspace/integrations" className={active === 'integrations' ? 'rw-nav-link is-active' : 'rw-nav-link'}>
          <Settings2 size={17}/> Connections
        </Link>
      </nav>
      <div className="rw-header-actions">
        <button type="button" className="rw-advanced-toggle" onClick={() => setOpen(value => !value)}
          aria-expanded={open} aria-controls="rw-advanced-menu">
          Other tools <ChevronDown size={15}/>
        </button>
        <button type="button" className="rw-mobile-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open} aria-controls="rw-advanced-menu" onClick={() => setOpen(value => !value)}>
          {open ? <X size={21}/> : <Menu size={21}/>}
        </button>
        <span className="rw-profile" aria-label="ARCHON workspace">A</span>
      </div>
      {open && <div id="rw-advanced-menu" className="rw-advanced-menu" role="navigation" aria-label="Additional navigation">
        <Link href="/workspace/revit" onClick={() => setOpen(false)} className="rw-mobile-only">Revit Workspace</Link>
        <Link href="/workspace/integrations" onClick={() => setOpen(false)} className="rw-mobile-only">Connections</Link>
        <p>Advanced / existing workflows</p>
        {advanced.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
          {item.label} <ArrowUpRight size={14}/>
        </Link>)}
      </div>}
    </header>
    {children}
  </main>;
}
