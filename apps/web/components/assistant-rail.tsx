'use client';

import { CheckCircle2, CircleDot, MessageSquare, Search, Send, TriangleAlert } from 'lucide-react';

const conversations = [
  ['Lebarkan kitchen menjadi 6.4 m','Layout • 2D Plan','10:24'],
  ['Adjust seating 120 pax','Space Planning','09:18'],
  ['Add dimension to all walls','2D Plan • Dimension','08:45'],
  ['Check circulation 1.5 m','Analysis • Compliance','08:12'],
  ['Zoning alternatif','Layout • Zoning','Yesterday'],
  ['Material palette selection','Design • Concept','Yesterday'],
  ['Revit export settings','Integrations • BIM','4 Sep']
];

type AssistantRailProps = {
  projectName?: string;
  intent?: string;
  changeSetState?: string;
  validationPass?: number;
  validationWarning?: number;
};

export function AssistantRail({
  projectName = 'ARCHON Project',
  intent = 'Widen kitchen to 6,400 mm while preserving structural grid',
  changeSetState = 'NEEDS_REVIEW',
  validationPass = 0,
  validationWarning = 0
}: AssistantRailProps){
  return <aside className="assistant-panel">
    <div className="assistant-head"><div><strong>ARCHON Assistant</strong><span className="online">● Agent online</span><small>{projectName}</small></div><button className="ghost">+ New Chat</button></div>
    <div className="conversation-search"><Search size={15}/><span>Search conversations...</span></div>
    <div className="conversation-scroll">
      <h4>Agent Execution</h4>
      <div className="execution-card">
        <div className="execution-title"><CircleDot size={16}/><span><b>{intent}</b><small>Governed execution • {changeSetState}</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Analyzing</b><small>Kitchen + connected boundaries identified</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Planning</b><small>Structural grid and BOH connection locked</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Modelling</b><small>Wall move +600 mm proposed in sandbox</small></span></div>
        <div className="execution-step active"><TriangleAlert size={15}/><span><b>Verifying</b><small>{validationPass} pass • {validationWarning} warning • waiting for approval</small></span></div>
        <div className="execution-progress"><span style={{width:'82%'}}/></div>
        <div className="execution-actions"><button>View Live</button><button>Inspect Plan</button></div>
      </div>
      <h4>Today</h4>{conversations.map(([title,meta,time],i)=><button className={i===0?'conversation active':'conversation'} key={title}><MessageSquare size={16}/><span><b>{title}</b><small>{meta}</small></span><time>{time}</time></button>)}
    </div>
    <div className="suggestions"><small>Suggested commands</small><button>Add dimensions to all rooms</button><button>Optimize layout for 120 pax</button><button>Check circulation width</button><button>Show 3D view of this plan</button></div>
    <div className="composer"><button>+</button><input placeholder="Ask ARCHON anything..."/><button><Send size={17}/></button></div>
    <div className="tip">Attachments: Image · Sketch · PDF · DWG · RVT · SKP · IFC</div>
  </aside>;
}
