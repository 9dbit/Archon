'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bell, CheckCircle2, Cuboid, FileText, Folder, Grid2X2, Layers3,
  LayoutDashboard, PanelTop, RotateCcw, Search, Settings2, SquareStack,
  Waypoints, ClipboardCheck, Boxes, Menu, X, UserRound, ChevronRight,
} from 'lucide-react';

export const NAV = [
  ['Overview', 'overview', LayoutDashboard], ['Project', 'project', Folder],
  ['Canvas', 'canvas', Grid2X2], ['Layout', 'layout', PanelTop],
  ['3D', '3d', Cuboid], ['Model', 'model', Boxes],
  ['Drawings', 'drawings', FileText], ['MEP', 'mep', Waypoints],
  ['Materials', 'materials', Layers3], ['BOQ', 'boq', ClipboardCheck],
  ['Docs', 'docs', SquareStack], ['Validate', 'validate', CheckCircle2],
  ['Versions', 'versions', RotateCcw], ['Integrations', 'integrations', Settings2],
] as const;

type Panel = 'navigation' | 'search' | 'notifications' | 'account' | null;

const QUICK_NAV = ['overview', 'project', 'layout', '3d'] as const;
const PATH = (slug: string) => `/workspace/${slug}`;

export function AppShell({ children, active = 'layout' }: {
  children: ReactNode;
  active?: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const results = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return value
      ? NAV.filter(([label, slug]) => `${label} ${slug}`.toLocaleLowerCase().includes(value))
      : NAV;
  }, [query]);

  useEffect(() => {
    setPanel(null);
  }, [active]);

  useEffect(() => {
    if (panel === null) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel(null);
    }
    window.addEventListener('keydown', onEscape);
    const focusHandle = window.requestAnimationFrame(() => {
      if (panel === 'search') searchRef.current?.focus();
      else closeRef.current?.focus();
    });
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onEscape);
      window.cancelAnimationFrame(focusHandle);
    };
  }, [panel]);

  function toggle(value: Exclude<Panel, null>) {
    setPanel(current => current === value ? null : value);
    if (value === 'search') setQuery('');
  }

  function navigate(slug: string) {
    setPanel(null);
    router.push(PATH(slug));
  }

  const sharedNavigation = (kind: 'desktop' | 'drawer') => NAV.map(([label, slug, Icon]) =>
    <Link
      key={slug}
      href={PATH(slug)}
      onClick={() => setPanel(null)}
      aria-current={active === slug ? 'page' : undefined}
      className={kind === 'desktop'
        ? `nav-item${active === slug ? ' active' : ''}`
        : `mobile-drawer-link${active === slug ? ' active' : ''}`}
    >
      <Icon size={kind === 'desktop' ? 19 : 20} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
      {kind === 'drawer' && <ChevronRight size={16} aria-hidden="true" />}
    </Link>
  );

  return <main className="app-shell">
    <header className="topbar">
      <Link href="/workspace/overview" className="brand" aria-label="ARCHON Overview">
        <span className="brand-mark">A</span><span>ARCHON</span>
      </Link>

      <nav className="topnav" aria-label="Desktop workspace navigation">
        {sharedNavigation('desktop')}
      </nav>

      <div className="top-actions">
        <button className="search app-search-button" type="button"
          onClick={() => toggle('search')} aria-label="Search ARCHON modules">
          <Search size={18} aria-hidden="true" /><span>Search modules...</span>
        </button>
        <button className="icon-button" type="button"
          onClick={() => toggle('notifications')} aria-label="Notification information">
          <Bell size={18} aria-hidden="true" />
        </button>
        <button type="button" className="avatar app-avatar-button"
          onClick={() => toggle('account')} aria-label="Open account information">AD</button>
      </div>

      <div className="mobile-brand-bar">
        <button className="mobile-toolbar-button" type="button"
          onClick={() => toggle('navigation')} aria-label="Open all ARCHON modules"
          aria-expanded={panel === 'navigation'} aria-controls="archon-mobile-menu">
          <Menu size={23} aria-hidden="true" />
        </button>
        <Link href="/workspace/overview" className="mobile-brand" aria-label="ARCHON Overview"
          onClick={() => setPanel(null)}>
          <span className="brand-mark">A</span><strong>ARCHON</strong>
        </Link>
        <div className="mobile-toolbar-actions">
          <button className="mobile-toolbar-button" type="button"
            onClick={() => toggle('search')} aria-label="Search modules">
            <Search size={21} aria-hidden="true" />
          </button>
          <button className="mobile-toolbar-button" type="button"
            onClick={() => toggle('notifications')} aria-label="Notification information">
            <Bell size={20} aria-hidden="true" />
          </button>
          <button className="mobile-avatar-button" type="button"
            onClick={() => toggle('account')} aria-label="Open account information">AD</button>
        </div>
      </div>
    </header>

    {children}

    <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
      {QUICK_NAV.map(slug => {
        const item = NAV.find(([, key]) => key === slug);
        if (!item) return null;
        const [label, , Icon] = item;
        return <Link key={slug} href={PATH(slug)}
          aria-current={active === slug ? 'page' : undefined}
          className={`mobile-bottom-link${active === slug ? ' active' : ''}`}>
          <Icon size={21} aria-hidden="true"/><span>{label}</span>
        </Link>;
      })}
      <button className={`mobile-bottom-link${panel === 'navigation' ? ' active' : ''}`}
        type="button" onClick={() => toggle('navigation')} aria-label="Show all modules">
        <Menu size={21} aria-hidden="true"/><span>More</span>
      </button>
    </nav>

    {panel !== null && <div className="mobile-overlay-layer" role="presentation">
      <button className="mobile-overlay-backdrop" type="button"
        aria-label="Close ARCHON panel" onClick={() => setPanel(null)} />
      <section
        className={`mobile-overlay-panel ${panel === 'navigation' ? 'mobile-navigation-drawer' : 'mobile-dialog-panel'}`}
        role="dialog" aria-modal="true" aria-labelledby="archon-mobile-dialog-title"
        id={panel === 'navigation' ? 'archon-mobile-menu' : undefined}
      >
        <div className="mobile-dialog-head">
          <div>
            <small>ARCHON WORKSPACE</small>
            <h2 id="archon-mobile-dialog-title">
              {panel === 'navigation' ? 'Modules' :
                panel === 'search' ? 'Search modules' :
                panel === 'notifications' ? 'Notifications' : 'Account'}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="mobile-dialog-close"
            aria-label="Close panel" onClick={() => setPanel(null)}>
            <X size={21} aria-hidden="true"/>
          </button>
        </div>

        {panel === 'navigation' &&
          <nav className="mobile-drawer-links" aria-label="All ARCHON modules">
            {sharedNavigation('drawer')}
          </nav>
        }

        {panel === 'search' && <div className="mobile-search-body">
          <label className="mobile-search-input">
            <Search size={19} aria-hidden="true"/>
            <span className="sr-only">Search workspace modules</span>
            <input ref={searchRef} value={query} placeholder="Find a module..."
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && results.length > 0) {
                  event.preventDefault();
                  navigate(results[0][1]);
                }
              }}
              autoComplete="off"/>
          </label>
          <div className="mobile-search-results">
            {results.length === 0 ? <p className="mobile-dialog-note">No modules match that search.</p> :
              results.map(([label, slug, Icon]) => <Link key={slug} href={PATH(slug)}
                onClick={() => setPanel(null)}>
                <Icon size={19} aria-hidden="true"/><span>{label}</span><ChevronRight size={16} aria-hidden="true"/>
              </Link>)
            }
          </div>
        </div>}

        {panel === 'notifications' &&
          <div className="mobile-dialog-body">
            <Bell size={24} aria-hidden="true"/>
            <h3>Notification center</h3>
            <p>Notifications are not yet connected to the Render standby. No live notification status is shown here.</p>
            <Link href="/workspace/overview" onClick={() => setPanel(null)} className="mobile-panel-action">
              Back to overview <ChevronRight size={17}/>
            </Link>
          </div>
        }
        {panel === 'account' &&
          <div className="mobile-dialog-body">
            <span className="mobile-dialog-avatar"><UserRound size={23} aria-hidden="true"/></span>
            <h3>ARCHON workspace</h3>
            <p>Render standby preview. Account management is not yet available in this deployment.</p>
            <Link href="/workspace/overview" onClick={() => setPanel(null)} className="mobile-panel-action">
              Go to overview <ChevronRight size={17}/>
            </Link>
          </div>
        }
      </section>
    </div>}
  </main>;
}
