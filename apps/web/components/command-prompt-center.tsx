'use client';

import { CheckCircle2, FileSearch, Loader2, LockKeyhole, MousePointer2, Send, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CanonicalObject } from './canonical-3d-viewport';
import type { ChangeOperation, LiveChangeSet } from './changeset-bar';

type TargetCandidate = { archonId: string; label: string; objectType: string };
type PreviewPayload = {
  state: string;
  intent: { summary: string; normalizedAction: string; targetArchonId: string | null; targetLabel: string | null; measurementMm: number | null };
  proposedChangeSet: { intentSummary: string; operations: ChangeOperation[]; canSubmit: boolean; blockedBy: string[] };
  drawingPlan: { includes: string[]; layerMapping: Record<string, string>; externalSync: string; apsExecutionEnabled: false };
  targetCandidates: TargetCandidate[];
  checklist: Array<{ stage: string; status: string; evidence: string }>;
  governance: Record<string, unknown>;
};
type CommandSample = { label: string; category: string; prompt: string };

const commandSamples: CommandSample[] = [
  { label: 'Move south wall', category: 'Edit geometry', prompt: 'Move south wall 500 mm outward' },
  { label: 'Pick wall target', category: 'Target review', prompt: 'Move wall 500 mm' },
  { label: 'Resize kitchen width', category: 'Room sizing', prompt: 'Resize kitchen width to 7.2 m' },
  { label: 'Set kitchen depth', category: 'Room sizing', prompt: 'Set kitchen depth to 6.4 m' },
  { label: 'DWG layer plan', category: 'Drawing preview', prompt: 'Generate CAD layer mapping with site boundary, walls, room labels and dimensions' },
  { label: 'Indonesian wall edit', category: 'Bahasa command', prompt: 'Geser dinding selatan 500 mm' }
];

const defaultPrompt = commandSamples[0].prompt;
const objectLabel = (object?: CanonicalObject) => typeof object?.parameters?.label === 'string' ? object.parameters.label : object?.archonId;

export function CommandPromptCenter({ projectId, objects, activeChangeSet, onProposalCreated, mode = 'layout' }: { projectId?: string; objects: CanonicalObject[]; activeChangeSet?: LiveChangeSet | null; onProposalCreated?: () => Promise<void> | void; mode?: 'layout' | 'drawings' }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTarget = useMemo(() => objects.find(object => object.archonId === selectedTargetId), [objects, selectedTargetId]);

  async function runPreview(targetId = selectedTargetId) {
    if (!projectId || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/command-center/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, targetArchonId: targetId ?? undefined })
      });
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
      const response = await fetch(`/api/projects/${projectId}/changesets/propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intentSummary: preview.proposedChangeSet.intentSummary, operations: preview.proposedChangeSet.operations })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'PROPOSAL_FAILED');
      await onProposalCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PROPOSAL_FAILED'); }
    finally { setBusy(false); }
  }

  function chooseSample(sample: CommandSample) {
    setPrompt(sample.prompt);
    setSelectedTargetId(null);
    setPreview(null);
    setError(null);
  }

  function chooseTarget(targetId: string) {
    setSelectedTargetId(targetId);
    void runPreview(targetId);
  }

  const blockers = preview?.proposedChangeSet.blockedBy ?? [];
  const canCreate = Boolean(preview?.proposedChangeSet.canSubmit && !activeChangeSet);
  const candidateNeedsReview = Boolean(preview && preview.targetCandidates.length > 1 && preview.state === 'NEEDS_TARGET_REVIEW');

  return <section className="command-center">
    <div className="command-center-head"><div><small>E8 COMMAND PROMPT CENTER - {mode.toUpperCase()} - {objects.length} canonical objects</small><h3>CAD Editing Sandbox</h3><p>Prompt becomes Intent, Proposed ChangeSet preview and validation checklist. APS/DWG execution stays locked.</p></div><strong>{preview?.state ?? 'READY'}</strong></div>
    <div className="command-samples">{commandSamples.map(sample => <button className="command-sample" key={sample.label} onClick={() => chooseSample(sample)}><span>{sample.category}</span><b>{sample.label}</b><small>{sample.prompt}</small></button>)}</div>
    <div className="command-compose"><FileSearch size={17}/><textarea value={prompt} onChange={event => { setPrompt(event.target.value); setPreview(null); setSelectedTargetId(null); }} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void runPreview(); }} /><button onClick={() => void runPreview()} disabled={!projectId || busy}>{busy ? <Loader2 className="spin" size={17}/> : <Send size={17}/>}Preview</button></div>
    {selectedTarget && <div className="command-selected-target"><CheckCircle2 size={15}/><span>Target locked for preview: <b>{objectLabel(selectedTarget)}</b> / {selectedTarget.archonId}</span><button onClick={() => { setSelectedTargetId(null); setPreview(null); }}>Clear</button></div>}
    {error && <div className="design-ai-error">{error}</div>}
    {activeChangeSet && <div className="command-lock"><LockKeyhole size={15}/><span>Active ChangeSet {activeChangeSet.id.slice(0, 8)} blocks new proposal creation. Sandbox preview remains available.</span></div>}
    {preview && <div className="command-result">
      <div className="command-intent"><ShieldCheck size={17}/><span><b>{preview.intent.summary}</b><small>{preview.intent.normalizedAction} - {preview.intent.targetLabel ?? 'target review pending'} - {preview.intent.measurementMm ? `${preview.intent.measurementMm} mm` : 'no graph measurement'}</small></span></div>
      <div className="command-grid"><div><b>Operations</b>{preview.proposedChangeSet.operations.length ? preview.proposedChangeSet.operations.map((operation, index) => <code key={`${operation.targetId}-${index}`}>{operation.type} - {operation.targetId} - {JSON.stringify(operation.payload)}</code>) : <small>No graph operation yet.</small>}</div><div><b>DWG Preview Plan</b><small>{preview.drawingPlan.includes.join(' - ')}</small><small>{Object.entries(preview.drawingPlan.layerMapping).map(([key, value]) => `${key}:${value}`).join(' - ')}</small></div></div>
      {candidateNeedsReview && <div className="command-candidates"><b>Target review required</b><small>Choose the exact canonical Building Graph target, then ARCHON reruns the preview with that target ID.</small><div className="command-candidate-list">{preview.targetCandidates.map(item => <button key={item.archonId} className={selectedTargetId === item.archonId ? 'selected' : ''} onClick={() => chooseTarget(item.archonId)} disabled={busy || !projectId}><MousePointer2 size={13}/><span><b>{item.label}</b><small>{item.objectType} - {item.archonId}</small></span></button>)}</div></div>}
      {!candidateNeedsReview && preview.targetCandidates.length > 1 && <div className="command-candidates"><b>Target candidates</b>{preview.targetCandidates.map(item => <small key={item.archonId}>{item.label} - {item.archonId}</small>)}</div>}
      <div className="command-checklist">{preview.checklist.map(item => <span key={item.stage} className={item.status.toLowerCase()}><b>{item.stage}</b><small>{item.status}</small></span>)}</div>
      {blockers.length > 0 && <div className="command-lock"><LockKeyhole size={15}/><span>{blockers.join(' - ')}</span></div>}
      <button className="command-create" onClick={() => void createProposal()} disabled={!canCreate || busy}>Create Proposed ChangeSet</button>
    </div>}
  </section>;
}
