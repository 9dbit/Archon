'use client';

import { FileSearch, Loader2, LockKeyhole, Send, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { CanonicalObject } from './canonical-3d-viewport';
import type { ChangeOperation, LiveChangeSet } from './changeset-bar';

type PreviewPayload = {
  state: string;
  intent: { summary: string; normalizedAction: string; targetArchonId: string | null; targetLabel: string | null; measurementMm: number | null };
  proposedChangeSet: { intentSummary: string; operations: ChangeOperation[]; canSubmit: boolean; blockedBy: string[] };
  drawingPlan: { includes: string[]; layerMapping: Record<string, string>; externalSync: string; apsExecutionEnabled: false };
  targetCandidates: Array<{ archonId: string; label: string; objectType: string }>;
  checklist: Array<{ stage: string; status: string; evidence: string }>;
  governance: Record<string, unknown>;
};

const examples = ['Move south wall 500 mm outward', 'Resize kitchen width to 7.2 m', 'Generate CAD layer mapping with site boundary, room labels and dimensions'];

export function CommandPromptCenter({ projectId, objects, activeChangeSet, onProposalCreated, mode = 'layout' }: { projectId?: string; objects: CanonicalObject[]; activeChangeSet?: LiveChangeSet | null; onProposalCreated?: () => Promise<void> | void; mode?: 'layout' | 'drawings' }) {
  const [prompt, setPrompt] = useState(examples[0]);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function runPreview() {
    if (!projectId || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/command-center/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'COMMAND_CENTER_PREVIEW_FAILED');
      setPreview(payload as PreviewPayload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'COMMAND_CENTER_PREVIEW_FAILED'); }
    finally { setBusy(false); }
  }
  async function createProposal() {
    if (!projectId || !preview || activeChangeSet || !preview.proposedChangeSet.operations.length || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/changesets/propose`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intentSummary: preview.proposedChangeSet.intentSummary, operations: preview.proposedChangeSet.operations }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'PROPOSAL_FAILED');
      await onProposalCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PROPOSAL_FAILED'); }
    finally { setBusy(false); }
  }
  const blockers = preview?.proposedChangeSet.blockedBy ?? [];
  const canCreate = Boolean(preview?.proposedChangeSet.canSubmit && !activeChangeSet);
  return <section className="command-center">
    <div className="command-center-head"><div><small>E8 COMMAND PROMPT CENTER · {mode.toUpperCase()} · {objects.length} canonical objects</small><h3>CAD Editing Sandbox</h3><p>Prompt becomes Intent, Proposed ChangeSet preview and validation checklist. APS/DWG execution stays locked.</p></div><strong>{preview?.state ?? 'READY'}</strong></div>
    <div className="command-examples">{examples.map(example => <button key={example} onClick={() => setPrompt(example)}>{example}</button>)}</div>
    <div className="command-compose"><FileSearch size={17}/><textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void runPreview(); }} /><button onClick={() => void runPreview()} disabled={!projectId || busy}>{busy ? <Loader2 className="spin" size={17}/> : <Send size={17}/>}Preview</button></div>
    {error && <div className="design-ai-error">{error}</div>}
    {activeChangeSet && <div className="command-lock"><LockKeyhole size={15}/><span>Active ChangeSet {activeChangeSet.id.slice(0, 8)} blocks new proposal creation. Sandbox preview remains available.</span></div>}
    {preview && <div className="command-result">
      <div className="command-intent"><ShieldCheck size={17}/><span><b>{preview.intent.summary}</b><small>{preview.intent.normalizedAction} · {preview.intent.targetLabel ?? 'target review pending'} · {preview.intent.measurementMm ? `${preview.intent.measurementMm} mm` : 'no graph measurement'}</small></span></div>
      <div className="command-grid"><div><b>Operations</b>{preview.proposedChangeSet.operations.length ? preview.proposedChangeSet.operations.map((operation, index) => <code key={`${operation.targetId}-${index}`}>{operation.type} · {operation.targetId} · {JSON.stringify(operation.payload)}</code>) : <small>No graph operation yet.</small>}</div><div><b>DWG Preview Plan</b><small>{preview.drawingPlan.includes.join(' · ')}</small><small>{Object.entries(preview.drawingPlan.layerMapping).map(([key, value]) => `${key}:${value}`).join(' · ')}</small></div></div>
      {preview.targetCandidates.length > 1 && <div className="command-candidates"><b>Target candidates</b>{preview.targetCandidates.map(item => <small key={item.archonId}>{item.label} · {item.archonId}</small>)}</div>}
      <div className="command-checklist">{preview.checklist.map(item => <span key={item.stage} className={item.status.toLowerCase()}><b>{item.stage}</b><small>{item.status}</small></span>)}</div>
      {blockers.length > 0 && <div className="command-lock"><LockKeyhole size={15}/><span>{blockers.join(' · ')}</span></div>}
      <button className="command-create" onClick={() => void createProposal()} disabled={!canCreate || busy}>Create Proposed ChangeSet</button>
    </div>}
  </section>;
}
