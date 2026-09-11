'use client';

import {
  Bell, Box, Boxes, CheckCircle2, ClipboardCheck, Cuboid, FileText, Folder,
  Grid2X2, Layers3, LayoutDashboard, MessageSquare, Move3D, PanelTop, PencilRuler,
  RotateCcw, Search, Send, Settings2, Sparkles, SquareStack, Upload, UsersRound,
  Waypoints, XCircle, ZoomIn
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  ['Overview', LayoutDashboard], ['Project', Folder], ['Canvas', Grid2X2], ['Layout', PanelTop],
  ['3D', Cuboid], ['Model', Boxes], ['Drawings', FileText], ['MEP', Waypoints],
  ['Materials', Layers3], ['BOQ', ClipboardCheck], ['Docs', SquareStack], ['Validate', CheckCircle2],
  ['Versions', RotateCcw], ['Integrations', Settings2]
] as const;

const conversations = [
  ['Lebarkan kitchen menjadi 6.4 m', 'Layout • 2D Plan', '10:24'],
  ['Adjust seating 120 pax', 'Space Planning', '09:18'],
  ['Add dimension to all walls', '2D Plan • Dimension', '08:45'],
  ['Check circulation 1.5 m', 'Analysis • Compliance', '08:12'],
  ['Zoning alternatif', 'Layout • Zoning', 'Yesterday'],
  ['Material palette selection', 'Design • Concept', 'Yesterday'],
  ['Revit export settings', 'Integrations • BIM', '4 Sep']
];

const roomStyle = (gridArea: string, tone: string) => ({ gridArea, '--room-tone': tone } as React.CSSProperties);

export default function HomePage() {
  const [active, setActive] = useState('Layout');
  const [subtab, setSubtab] = useState('2D Plan');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span><span>ARCHON</span></div>
        <nav className="topnav">
          {navItems.map(([label, Icon]) => (
            <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}>
              <Icon size={19} strokeWidth={1.7}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <div className="search"><Search size={17}/><span>Search...</span></div>
          <button className="icon-button"><Bell size={18}/><i className="online-dot"/></button>
          <div className="avatar">AD</div>
        </div>
      </header>

      <section className="workgrid">
        <aside className="assistant-panel">
          <div className="assistant-head">
            <div><strong>AI Assistant</strong><span className="online">● Online</span><small>Your Architecture Partner</small></div>
            <button className="ghost">+ New Chat</button>
          </div>
          <div className="conversation-search"><Search size={15}/><span>Search conversations...</span></div>
          <div className="conversation-scroll">
            <h4>Today</h4>
            {conversations.map(([title, meta, time], index) => (
              <button className={index === 0 ? 'conversation active' : 'conversation'} key={title}>
                <MessageSquare size={16}/><span><b>{title}</b><small>{meta}</small></span><time>{time}</time>
              </button>
            ))}
          </div>
          <div className="suggestions">
            <small>Suggested commands</small>
            <button>Add dimensions to all rooms</button><button>Optimize layout for 120 pax</button>
            <button>Check circulation width</button><button>Show 3D view of this plan</button>
          </div>
          <div className="composer"><button>+</button><input placeholder="Ask ARCHON anything..."/><button><Send size={17}/></button></div>
          <div className="tip">Tip: Try “Lebarkan kitchen 300 mm ke timur”</div>
        </aside>

        <section className="workspace">
          <div className="workspace-head">
            <div><strong>Layout Studio</strong><small>Create precise layouts with AI. Edit in 2D CAD or 3D, sync with AutoCAD / Revit.</small></div>
            <div className="workspace-actions"><button>Ground Floor ▾</button><button>AutoCAD</button><button>Revit</button><button>Sync</button><button>Export</button><button className="primary">Save</button></div>
          </div>

          <div className="subtabs">
            {['2D Plan','Space Planning','Zoning','Circulation','Area & Capacity','Program','3D Layout'].map(label =>
              <button key={label} onClick={() => setSubtab(label)} className={subtab === label ? 'active' : ''}>{label}</button>
            )}
          </div>

          <div className="toolrow">
            {[['Select',PencilRuler],['Line',Upload],['Move',Move3D],['Rotate',RotateCcw],['Copy',SquareStack],['Dimension',PencilRuler],['Layer',Layers3],['Block',Box],['Measure',ZoomIn]].map(([label, Icon]) => (
              <button key={label as string} className={label === 'Select' ? 'tool active' : 'tool'}><Icon size={17}/><span>{label as string}</span></button>
            ))}
          </div>

          <div className="viewport-wrap">
            <div className="cad-grid">
              <div className="dimension dim-top">24,800 mm</div>
              <div className="dimension dim-left">15,000 mm</div>
              <div className="floorplan">
                <div className="room kitchen" style={roomStyle('kitchen','#c7ced2')}><b>KITCHEN</b><span>A: 45.0 m²</span><small>FFL +0.000</small></div>
                <div className="room storage" style={roomStyle('storage','#d7d7d2')}><b>STORAGE</b><span>A: 12.0 m²</span></div>
                <div className="room restroom1" style={roomStyle('restroom1','#c4d1d9')}><b>RESTROOM M</b><span>A: 18.0 m²</span></div>
                <div className="room restroom2" style={roomStyle('restroom2','#c4d1d9')}><b>RESTROOM F</b><span>A: 18.0 m²</span></div>
                <div className="room bar" style={roomStyle('bar','#7b8d91')}><b>BAR</b><span>A: 20.0 m²</span></div>
                <div className="room dining" style={roomStyle('dining','#ded4bd')}><b>INDOOR DINING</b><span>A: 120.0 m²</span><div className="tables">{Array.from({length:24}).map((_,i)=><i key={i}/>)}</div></div>
                <div className="room entrance" style={roomStyle('entrance','#d9c9ab')}><b>MAIN ENTRANCE</b><span>A: 15.0 m²</span></div>
                <div className="room outdoor" style={roomStyle('outdoor','#ceb890')}><b>OUTDOOR DINING</b><span>A: 80.0 m²</span></div>
                <div className="room terrace" style={roomStyle('terrace','#b79068')}><b>OCEAN VIEW TERRACE</b><span>A: 40.0 m²</span></div>
              </div>
              <div className="gridlabels top"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
              <div className="plan-footer"><strong>01 · GROUND FLOOR PLAN</strong><span>SCALE 1:100</span></div>
            </div>

            <div className="changeset-bar">
              <div><span className="status-dot"/><b>PROPOSED CHANGE</b><small>CS-0142</small><p>Lebarkan kitchen menjadi 6,400 mm (+600 mm) · 27 objects affected</p></div>
              <div className="validation-count"><span>8 ✓</span><span>1 ⚠</span></div>
              <button>Preview Changes</button><button>Edit</button><button className="approve">Approve</button><button className="discard"><XCircle size={15}/>Discard</button>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <div className="inspector-tabs"><button className="active">Properties</button><button>Relationships</button><button>Validation</button><button>History</button></div>
          <section><div className="section-head"><b>Wall</b><button>Edit</button></div><dl><dt>ID</dt><dd>W-014</dd><dt>Type</dt><dd>Interior Partition</dd><dt>Length</dt><dd>6,400 mm</dd><dt>Height</dt><dd>3,200 mm</dd><dt>Thickness</dt><dd>150 mm</dd><dt>Material</dt><dd>AAC + Plaster</dd><dt>Layer</dt><dd>A-WALL</dd><dt>Level</dt><dd>Ground Floor</dd></dl></section>
          <section><b>Connected Elements</b><div className="chips"><span>Kitchen R-01</span><span>Storage R-02</span><span>Door D-03</span><span>Window W-05</span></div></section>
          <section><b>Validation</b><ul className="checks"><li>✓ Geometry dimension OK</li><li>✓ Meets fire rating requirement</li><li>✓ Connected to room boundaries</li><li className="warning">⚠ Acoustic requirement not defined</li></ul></section>
          <section><b>Tags</b><div className="chips"><span>Interior</span><span>Kitchen</span><span>Structural</span></div></section>
        </aside>
      </section>
    </main>
  );
}
