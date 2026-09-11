import { AppShell } from '../../../components/app-shell';
import { AssistantRail } from '../../../components/assistant-rail';
import { Inspector } from '../../../components/inspector';
import { ChangeSetBar } from '../../../components/changeset-bar';

const titles: Record<string,string> = {overview:'Overview',project:'Project',canvas:'Design Canvas',layout:'Layout Studio','3d':'3D Studio',model:'Building Model',drawings:'Technical Drawings',mep:'MEP',materials:'Materials',boq:'BOQ & Cost',docs:'Documents',validate:'Validation',versions:'Versions',integrations:'Integrations'};

export default async function ModulePage({ params }: { params: Promise<{module:string}> }) {
  const { module } = await params;
  const title = titles[module] ?? 'Workspace';
  return <AppShell active={module}>
    <section className="workgrid">
      <AssistantRail />
      <section className="workspace">
        <div className="workspace-head"><div><strong>{title}</strong><small>ARCHON production workspace. Module content is connected through the same governed shell.</small></div></div>
        {module === 'layout' ? <LayoutModule/> : <ModulePlaceholder title={title}/>} 
      </section>
      <Inspector />
    </section>
  </AppShell>;
}

function ModulePlaceholder({title}:{title:string}){
  return <div className="viewport-wrap"><div className="cad-grid" style={{display:'grid',placeItems:'center',minHeight:620}}><div style={{textAlign:'center'}}><h2>{title}</h2><p>Production module skeleton ready for the next implementation slice.</p></div></div></div>;
}

function LayoutModule(){
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
      <ChangeSetBar/>
    </div>
  </>;
}
