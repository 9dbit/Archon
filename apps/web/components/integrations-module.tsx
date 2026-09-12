'use client';

import { useEffect, useState } from 'react';

type StatusPayload = {
  connection?: { state: string; authVerified: boolean; automationVerified: boolean; autoCadEngines: string[]; diagnostics: string[]; checkedAt?: string; resourceHandshakeVerified?: boolean; };
  adapter: {
    id: string;
    label: string;
    health: 'READY' | 'DEGRADED' | 'OFFLINE';
    configured: boolean;
    missing: string[];
    capabilities: string[];
    mode: string;
    nextAction: string;
  };
};

export function IntegrationsModule() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => { void fetch('/api/integrations/autocad/status', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'AUTOCAD_STATUS_FAILED');
        if (active) setData(payload as StatusPayload);
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'AUTOCAD_STATUS_FAILED'); }); };
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const adapter = data?.adapter;
  return <div className="viewport-wrap"><div style={{padding:24,display:'grid',gap:16}}>
    <div><small style={{opacity:.65}}>E8.2 · APS CONNECTION</small><h2 style={{margin:'6px 0'}}>AutoCAD / Autodesk APS</h2><p style={{maxWidth:760,opacity:.78}}>ARCHON remains the canonical source of truth. AutoCAD will receive governed jobs only after proposal review and approval boundaries are satisfied.</p></div>
    {error&&<div className="design-ai-error">{error}</div>}
    <section style={{border:'1px solid #273127',borderRadius:12,padding:16,background:'#111611',maxWidth:820}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><b>{adapter?.label??'Checking adapter…'}</b><small style={{display:'block',opacity:.62}}>Mode: {adapter?.mode??'APS_AUTOMATION'}</small></div><strong>{adapter?.health??'CHECKING'}</strong></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:14}}>{(adapter?.capabilities??['2D_DRAFTING','DRAWING_GENERATION','MODEL_EXCHANGE']).map(item=><div key={item} style={{border:'1px solid #243024',borderRadius:8,padding:10}}><small>{item}</small></div>)}</div>
      <div style={{marginTop:14,fontSize:13}}><b>Credential readiness</b><p style={{margin:'6px 0',opacity:.75}}>{adapter?.configured?'Credentials detected. Next checkpoint is live APS OAuth + Automation capability probe.':`Missing: ${adapter?.missing.join(', ')||'checking…'}`}</p><p style={{margin:0,opacity:.72}}>{adapter?.nextAction}</p></div>
    </section>
    <section style={{border:'1px solid #273127',borderRadius:12,padding:16,maxWidth:820}}>
      <b>Autodesk connection: {data?.connection?.state ?? 'Checking…'}</b>
      <p>OAuth: {data?.connection?.authVerified ? 'Verified' : 'Not verified'} · AutoCAD access: {data?.connection?.automationVerified ? 'Verified' : 'Not verified'}</p>
      {Boolean(data?.connection?.autoCadEngines.length) && <p>Available engines: {data?.connection?.autoCadEngines.join(', ')}</p>}
      <p>{data?.connection?.diagnostics.join(' · ')}</p>
      {data?.connection?.checkedAt && <small>Checked: {new Date(data.connection.checkedAt).toLocaleString()}</small>}
    </section>
    <small style={{opacity:.62}}>No DWG job can execute from this screen yet. DWG execution remains blocked even after connection validation succeeds.</small>
  </div></div>;
}
