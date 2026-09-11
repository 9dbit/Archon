'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssistantRail } from './assistant-rail';
import { ChangeSetBar, type LiveChangeSet, type ValidationFinding } from './changeset-bar';
import { Inspector } from './inspector';

type ProjectListItem = {
  id: string;
  name: string;
  status: string;
  buildingType: string | null;
  locationText: string | null;
  currentApprovedVersionId: string | null;
};

type ProjectVersion = { id: string; versionNumber: number };
type ProjectSummary = {
  project: ProjectListItem;
  versions: ProjectVersion[];
  proposedChanges: LiveChangeSet[];
  validationFindings: ValidationFinding[];
};

const titles: Record<string,string> = {overview:'Overview',project:'Project',canvas:'Design Canvas',layout:'Layout Studio','3d':'3D Studio',model:'Building Model',drawings:'Technical Drawings',mep:'MEP',materials:'Materials',boq:'BOQ & Cost',docs:'Documents',validate:'Validation',versions:'Versions',integrations:'Integrations'};

export function WorkspaceRuntime({ module }: { module: string }) {
  const [summary,setSummary] = useState<ProjectSummary | null>(null);
  const [loadError,setLoadError] = useState<string | null>(null);
  const title = titles[module] ?? 'Workspace';

  const loadProject = useCallback(async()=>{
    try {
      setLoadError(null);
      const listResponse = await fetch('/api/projects', { cache:'no-store' });
      const listPayload = await listResponse.json();
      if(!listResponse.ok) throw new Error(listPayload.error ?? 'PROJECT_LIST_FAILED');
      const project = (listPayload.projects as ProjectListItem[])[0];
      if(!project) throw new Error('NO_PROJECTS');
      const summaryResponse = await fetch(`/api/projects/${project.id}`, { cache:'no-store' });
      const summaryPayload = await summaryResponse.json();
      if(!summaryResponse.ok) throw new Error(summaryPayload.error ?? 'PROJECT_LOAD_FAILED');
      setSummary(summaryPayload as ProjectSummary);
    } catch(cause) {
      setLoadError(cause instanceof Error ? cause.message : 'PROJECT_LOAD_FAILED');
    }
  },[]);

  useEffect(()=>{ void loadProject(); },[loadProject]);

  const activeChange = useMemo(()=>summary?.proposedChanges.find((change)=>['NEEDS_REVIEW','APPROVED'].includes(change.state)) ?? null,[summary]);
  const activeFindings = useMemo(()=>activeChange ? (summary?.validationFindings ?? []).filter((finding)=>finding.changeSetId===activeChange.id) : [],[summary,activeChange]);
  const passCount = activeFindings.filter((finding)=>finding.status==='PASS').length;
  const warningCount = activeFindings.filter((finding)=>finding.status==='WARNING').length;
  const currentVersion = summary?.versions[0]?.versionNumber ?? 0;

  return <section className="workgrid">
    <AssistantRail
      projectName={summary?.project.name}
      intent={activeChange?.intentSummary}
      changeSetState={activeChange?.state}
      validationPass={passCount}
      validationWarning={warningCount}
    />
    <section className="workspace">
      <div className="workspace-head">
        <div><strong>{title}</strong><small>{summary ? `${summary.project.name} · ${summary.project.locationText ?? 'Location pending'}` : 'Connecting to ARCHON production data...'}</small></div>
        <div className="runtime-meta"><span>{summary?.project.status ?? 'LOADING'}</span><b>Version {currentVersion || '—'}</b></div>
      </div>
      {loadError ? <RuntimeError message={loadError} retry={loadProject}/> : module === 'layout' ? <LayoutModule changeSet={activeChange} findings={activeFindings} refresh={loadProject}/> : <ModulePlaceholder title={title} projectName={summary?.project.name}/>} 
    </section>
    <Inspector />
  </section>;
}

function RuntimeError({message,retry}:{message:string;retry:()=>Promise<void>}){
  return <div className="viewport-wrap"><div className="cad-grid" style={{display:'grid',placeItems:'center',minHeight:620}}><div style={{textAlign:'center'}}><h2>Production data unavailable</h2><p>{message}</p><button onClick={()=>void retry()}>Retry connection</button></div></div></div>;
}

function ModulePlaceholder({title,projectName}:{title:string;projectName?:string}){
  return <div className="viewport-wrap"><div className="cad-grid" style={{display:'grid',placeItems:'center',minHeight:620}}><div style={{textAlign:'center'}}><h2>{title}</h2><p>{projectName ? `${projectName} is connected to PostgreSQL.` : 'Loading project context...'}</p><small>Production module skeleton ready for the next implementation slice.</small></div></div></div>;
}

function LayoutModule({changeSet,findings,refresh}:{changeSet:LiveChangeSet|null;findings:ValidationFinding[];refresh:()=>Promise<void>}){
  return <>
    <div className="subtabs">{['2D Plan','Space Planning','Zoning','Circulation','Area & Capacity','Program','3D Layout'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}</button>)}</div>
    <div className="viewport-wrap">
      <div className="cad-grid"><div className="dimension dim-top">24,800 mm</div><div className="dimension dim-left">15,000 mm</div><div className="floorplan">
        <div className="room kitchen" style={{gridArea:'kitchen','--room-tone':'#c7ced2'} as React.CSSProperties}><b>KITCHEN</b><span>A: 45.0 m²</span><small>FFL +0.000</small></div>
        <div className="room storage" style={{gridArea:'storage','--room-tone':'#d7d7d2'} as React.CSSProperties}><b>STORAGE</b><span>A: 12.0 m²</span></div>
        <div className="room restroom1" style={{gridArea:'restroom1','--room-tone':'#c4d1d9'} as React.CSSProperties}><b>RESTROOM M</b><span>A: 18.0 m²</span></div>
        <div className="room restroom2" style={{gridArea:'restroom2','--room-tone':'#c4d1d9'} as React.CSSProperties}><b>RESTROOM F</b><span>A: 18.0 m²</span></div>
        <div className="room bar" style={{gridArea:'bar','--room-tone':'#7b8d91'} as React.CSSProperties}><b>BAR</b><span>A: 20.0 m²</span></div>
        <div className="room dining" style={{gridArea:'dining','--room-tone':'#ded4bd'} as React.CSSProperties}><b>INDOOR DINING</b><span>A: 120.0 m²</span></div>
        <div className="room entrance" style={{gridArea:'entrance','--room-tone':'#d9c9ab'} as React.CSSProperties}><b>MAIN ENTRANCE</b><span>A: 15.0 m²</span></div>
        <div className="room outdoor" style={{gridArea:'outdoor','--room-tone':'#ceb890'} as React.CSSProperties}><b>OUTDOOR DINING</b><span>A: 80.0 m²</span></div>
        <div className="room terrace" style={{gridArea:'terrace','--room-tone':'#b79068'} as React.CSSProperties}><b>OCEAN VIEW TERRACE</b><span>A: 40.0 m²</span></div>
      </div><div className="plan-footer"><strong>01 · GROUND FLOOR PLAN</strong><span>SCALE 1:100</span></div></div>
      <ChangeSetBar changeSet={changeSet} findings={findings} onCommitted={refresh}/>
    </div>
  </>;
}
