'use client';

import { CheckCircle2, CircleDot, MessageSquare, Search, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

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
  selectedObjectLabel?: string | null;
  onSubmitCommand?: (command:string)=>Promise<void>;
};

export function AssistantRail({
  projectName = 'ARCHON Project',
  intent = 'Select an object and describe a governed edit',
  changeSetState = 'READY',
  validationPass = 0,
  validationWarning = 0,
  selectedObjectLabel,
  onSubmitCommand
}: AssistantRailProps){
  const [command,setCommand]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  async function submit(){
    const value=command.trim(); if(!value||!onSubmitCommand||busy)return;
    setBusy(true);setError(null);
    try{await onSubmitCommand(value);setCommand('')}catch(cause){setError(cause instanceof Error?cause.message:'COMMAND_FAILED')}finally{setBusy(false)}
  }
  return <aside className="assistant-panel">
    <div className="assistant-head"><div><strong>ARCHON Assistant</strong><span className="online">● Agent online</span><small>{projectName}</small></div><button className="ghost">+ New Chat</button></div>
    <div className="conversation-search"><Search size={15}/><span>Search conversations...</span></div>
    <div className="conversation-scroll">
      <h4>Agent Execution</h4>
      <div className="execution-card">
        <div className="execution-title"><CircleDot size={16}/><span><b>{intent}</b><small>Governed execution • {changeSetState}</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Analyzing</b><small>{selectedObjectLabel?`${selectedObjectLabel} identified in Building Graph`:'Select a canonical object in the viewport'}</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Planning</b><small>Approved Building state remains locked</small></span></div>
        <div className="execution-step"><CheckCircle2 size={15}/><span><b>Sandboxing</b><small>Commands normalize into structured ChangeSet operations</small></span></div>
        <div className="execution-step active"><TriangleAlert size={15}/><span><b>Verifying</b><small>{validationPass} pass • {validationWarning} warning • approval required before commit</small></span></div>
        <div className="execution-progress"><span style={{width:changeSetState==='NEEDS_REVIEW'?'88%':'35%'}}/></div>
        <div className="execution-actions"><button>View Live</button><button>Inspect Plan</button></div>
      </div>
      <h4>Today</h4>{conversations.map(([title,meta,time],i)=><button className={i===0?'conversation active':'conversation'} key={title}><MessageSquare size={16}/><span><b>{title}</b><small>{meta}</small></span><time>{time}</time></button>)}
    </div>
    <div className="suggestions"><small>3D authoring examples</small><button onClick={()=>setCommand('Geser object ini 600 mm ke kanan')}>Geser object ini 600 mm ke kanan</button><button onClick={()=>setCommand('Geser object ini 300 mm ke kiri')}>Geser object ini 300 mm ke kiri</button><button onClick={()=>setCommand('Geser object ini 200 mm ke atas')}>Geser object ini 200 mm ke atas</button></div>
    {error&&<div className="tip">Command error: {error}</div>}
    <div className="composer"><button>+</button><input value={command} onChange={event=>setCommand(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void submit()}} placeholder={selectedObjectLabel?`Edit ${selectedObjectLabel}...`:'Select an object first...'}/><button disabled={!selectedObjectLabel||busy} onClick={()=>void submit()}><Send size={17}/></button></div>
    <div className="tip">{selectedObjectLabel?`Target locked: ${selectedObjectLabel}`:'Attachments: Image · Sketch · PDF · DWG · RVT · SKP · IFC'}</div>
  </aside>;
}
