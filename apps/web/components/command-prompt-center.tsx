'use client';

import { CheckCircle2, FileSearch, Loader2, LockKeyhole, MousePointer2, RefreshCw, RotateCcw, Send, ShieldCheck } from 'lucide-react';
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
type SubmitGate = { status: 'PENDING' | 'BLOCKED' | 'READY' | 'LOCKED'; title: string; detail: string; actionLabel: string };

const commandSamples: CommandSample[] = [
  { label: 'Move south wall', category: 'Edit geometry', prompt: 'Move south wall 500 mm outward' },
  { label: 'Pick wall target', category: 'Target review', prompt: 'Move wall 500 mm' },
  { label: 'Resize kitchen width', category: 'Room sizing', prompt: 'Resize kitchen width to 7.2 m' },
  { label: 'Set kitchen depth', category: 'Room sizing', prompt: 'Set kitchen depth to 6.4 m' },
  { label: 'DWG layer plan', category: 'Drawing preview', prompt: 'Generate CAD layer mapping with site boundary, walls, room labels and dimensions' },
  { label: 'Indonesian wall edit', category: 'Bahasa command', prompt: 'Geser dinding selatan 500 mm' }
];

const defaultPrompt = commandSamples[0].prompt;
const flow = ['Intent', 'Preview', 'Validation', 'Review/Edit', 'Approval'];
const moveKeys = ['deltaXmm', 'deltaYmm', 'deltaZmm'];
const updateKeys = ['widthMm', 'heightMm', 'depthMm'];
const allKeys = [...moveKeys, ...updateKeys];
const objectLabel = (object?: CanonicalObject) => typeof object?.parameters?.label === 'string' ? object.parameters.label : object?.archonId;
const cloneOperations = (operations: ChangeOperation[]) => operations.map(operation => ({ type: operation.type, targetId: operation.targetId, payload: { ...operation.payload } }));
const operationKeys = (type: string) => type === 'UPDATE' ? updateKeys : moveKeys;

function submitGate(preview: PreviewPayload | null, activeChangeSet: LiveChangeSet | null | undefined, candidateNeedsReview: boolean, reviewedOperations: ChangeOperation[], reviewErrors: string[]): SubmitGate {
  if (!preview) return { status: 'PENDING', title: 'Preview required', detail: 'Run sandbox preview first. ARCHON will not create a proposal directly from raw prompt text.', actionLabel: 'Preview Required' };
  if (candidateNeedsReview) return { status: 'PENDING', title: 'Target review required', detail: 'Choose one canonical Building Graph target before proposal creation is available.', actionLabel: 'Choose Target First' };
  if (!preview.proposedChangeSet.operations.length) return { status: 'LOCKED', title: 'Drawing preview only', detail: 'This command prepares a DWG preview plan and layer mapping, but does not contain a Building Graph operation.', actionLabel: 'No Graph Operation' };
  if (!reviewedOperations.length) return { status: 'PENDING', title: 'Operation review required', detail: 'Review the generated operation before proposal creation is available.', actionLabel: 'Review Operation First' };
  if (reviewErrors.length) return { status: 'BLOCKED', title: 'Operation review has errors', detail: reviewErrors[0], actionLabel: 'Fix Reviewed Operation' };
  if (activeChangeSet) return { status: 'BLOCKED', title: 'Active ChangeSet blocks submit', detail: 'Resolve the active ChangeSet below with Review/Edit, Rebase, Approve, or Discard before creating another proposal.', actionLabel: 'Resolve Active ChangeSet' };
  const liveBlockers = preview.proposedChangeSet.blockedBy.filter(item => item !== 'ACTIVE_CHANGESET_EXISTS');
  if (liveBlockers.length) return { status: 'BLOCKED', title: 'Submit blocked by governance', detail: liveBlockers.join(' - '), actionLabel: 'Blocked' };
  return { status: 'READY', title: 'Ready for governed proposal', detail: 'Create Proposed ChangeSet will submit the reviewed operation to the existing governed route. Approval and immutable versioning still happen later in the ChangeSet bar.', actionLabel: 'Create Proposed ChangeSet' };
}

export function CommandPromptCenter({ projectId, objects, activeChangeSet, onProposalCreated, mode = 'layout' }: { projectId?: string; objects: CanonicalObject[]; activeChangeSet?: LiveChangeSet | null; onProposalCreated?: () => Promise<void> | void; mode?: 'layout' | 'drawings' }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [reviewedOperations, setReviewedOperations] = useState<ChangeOperation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTarget = useMemo(() => objects.find(object => object.archonId === selectedTargetId), [objects, selectedTargetId]);

  const reviewErrors = useMemo(() => {
    const targetIds = new Set(objects.map(object => object.archonId));
    const errors: string[] = [];
    reviewedOperations.forEach((operation, index) => {
      const label = `Operation ${index + 1}`;
      if (!['MOVE', 'UPDATE'].includes(operation.type)) errors.push(`${label}: unsupported type ${operation.type}`);
      if (!targetIds.has(operation.targetId)) errors.push(`${label}: target does not exist in canonical Building Graph`);
      const keys = Object.entries(operation.payload).filter(([, value]) => value !== undefined && value !== null);
      const numericKeys = keys.filter(([, value]) => typeof value === 'number' && Number.isFinite(value));
      if (!numericKeys.length) errors.push(`${label}: at least one numeric payload value is required`);
      for (const [key, value] of keys) {
        if (!allKeys.includes(key)) errors.push(`${label}: unsupported payload field ${key}`);
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${label}: ${key} must be a finite number`);
      }
    });
    return errors;
  }, [objects, reviewedOperations]);

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
      const nextPreview = payload as PreviewPayload;
      setPreview(nextPreview);
      setReviewedOperations(cloneOperations(nextPreview.proposedChangeSet.operations));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'COMMAND_CENTER_PREVIEW_FAILED'); }
    finally { setBusy(false); }
  }

  async function createProposal() {
    if (!projectId || !preview || activeChangeSet || !reviewedOperations.length || reviewErrors.length || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/changesets/propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intentSummary: preview.proposedChangeSet.intentSummary, operations: reviewedOperations })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'PROPOSAL_FAILED');
      setPreview(null);
      setSelectedTargetId(null);
      setReviewedOperations([]);
      await onProposalCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PROPOSAL_FAILED'); }
    finally { setBusy(false); }
  }

  async function refreshProjectState() {
    setBusy(true); setError(null);
    try { await onProposalCreated?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'REFRESH_FAILED'); }
    finally { setBusy(false); }
  }

  function chooseSample(sample: CommandSample) {
    setPrompt(sample.prompt);
    setSelectedTargetId(null);
    setPreview(null);
    setReviewedOperations([]);
    setError(null);
  }

  function chooseTarget(targetId: string) {
    setSelectedTargetId(targetId);
    void runPreview(targetId);
  }

  function focusActiveChangeSet() {
    document.getElementById('active-changeset-resolution')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetReview() {
    setReviewedOperations(cloneOperations(preview?.proposedChangeSet.operations ?? []));
  }

  function updateOperation(index: number, patch: Partial<ChangeOperation>) {
    setReviewedOperations(operations => operations.map((operation, operationIndex) => operationIndex === index ? { ...operation, ...patch, payload: patch.payload ?? operation.payload } : operation));
  }

  function updatePayload(index: number, key: string, value: string) {
    const parsed = Number(value);
    setReviewedOperations(operations => operations.map((operation, operationIndex) => operationIndex === index ? { ...operation, payload: { ...operation.payload, [key]: value === '' ? undefined : parsed } } : operation));
  }

  const blockers = preview?.proposedChangeSet.blockedBy ?? [];
  const candidateNeedsReview = Boolean(preview && preview.targetCandidates.length > 1 && preview.state === 'NEEDS_TARGET_REVIEW');
  const gate = submitGate(preview, activeChangeSet, candidateNeedsReview, reviewedOperations, reviewErrors);
  const canCreate = gate.status === 'READY';

  return <section className="command-center">
    <div className="command-center-head"><div><small>E8 COMMAND PROMPT CENTER - {mode.toUpperCase()} - {objects.length} canonical objects</small><h3>CAD Editing Sandbox</h3><p>Prompt becomes Intent, Proposed ChangeSet preview and validation checklist. APS/DWG execution stays locked.</p></div><strong>{preview?.state ?? 'READY'}</strong></div>
    <div className="command-samples">{commandSamples.map(sample => <button className="command-sample" key={sample.label} onClick={() => chooseSample(sample)}><span>{sample.category}</span><b>{sample.label}</b><small>{sample.prompt}</small></button>)}</div>
    <div className="command-compose"><FileSearch size={17}/><textarea value={prompt} onChange={event => { setPrompt(event.target.value); setPreview(null); setReviewedOperations([]); setSelectedTargetId(null); }} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void runPreview(); }} /><button onClick={() => void runPreview()} disabled={!projectId || busy}>{busy ? <Loader2 className="spin" size={17}/> : <Send size={17}/>}Preview</button></div>
    {selectedTarget && <div className="command-selected-target"><CheckCircle2 size={15}/><span>Target locked for preview: <b>{objectLabel(selectedTarget)}</b> / {selectedTarget.archonId}</span><button onClick={() => { setSelectedTargetId(null); setPreview(null); setReviewedOperations([]); }}>Clear</button></div>}
    {error && <div className="design-ai-error">{error}</div>}
    {activeChangeSet && <div className="command-lock"><LockKeyhole size={15}/><span>Active ChangeSet {activeChangeSet.id.slice(0, 8)} blocks new proposal creation. Sandbox preview remains available.</span></div>}
    {preview && <div className="command-result">
      <div className="command-intent"><ShieldCheck size={17}/><span><b>{preview.intent.summary}</b><small>{preview.intent.normalizedAction} - {preview.intent.targetLabel ?? 'target review pending'} - {preview.intent.measurementMm ? `${preview.intent.measurementMm} mm` : 'no graph measurement'}</small></span></div>
      <div className="command-grid"><div><b>Generated Operations</b>{preview.proposedChangeSet.operations.length ? preview.proposedChangeSet.operations.map((operation, index) => <code key={`${operation.targetId}-${index}`}>{operation.type} - {operation.targetId} - {JSON.stringify(operation.payload)}</code>) : <small>No graph operation yet.</small>}</div><div><b>DWG Preview Plan</b><small>{preview.drawingPlan.includes.join(' - ')}</small><small>{Object.entries(preview.drawingPlan.layerMapping).map(([key, value]) => `${key}:${value}`).join(' - ')}</small></div></div>
      {candidateNeedsReview && <div className="command-candidates"><b>Target review required</b><small>Choose the exact canonical Building Graph target, then ARCHON reruns the preview with that target ID.</small><div className="command-candidate-list">{preview.targetCandidates.map(item => <button key={item.archonId} className={selectedTargetId === item.archonId ? 'selected' : ''} onClick={() => chooseTarget(item.archonId)} disabled={busy || !projectId}><MousePointer2 size={13}/><span><b>{item.label}</b><small>{item.objectType} - {item.archonId}</small></span></button>)}</div></div>}
      {!candidateNeedsReview && preview.targetCandidates.length > 1 && <div className="command-candidates"><b>Target candidates</b>{preview.targetCandidates.map(item => <small key={item.archonId}>{item.label} - {item.archonId}</small>)}</div>}
      {reviewedOperations.length > 0 && <div className="command-operation-review"><div className="command-operation-review-head"><span><b>Editable Operation Review</b><small>These reviewed values are submitted to the governed proposal endpoint.</small></span><button onClick={resetReview}><RotateCcw size={13}/>Reset to preview</button></div>{reviewedOperations.map((operation, index) => <div className="command-operation-row" key={`${operation.targetId}-${index}`}><select value={operation.type} onChange={event => updateOperation(index, { type: event.target.value, payload: {} })}><option value="MOVE">MOVE</option><option value="UPDATE">UPDATE</option></select><select value={operation.targetId} onChange={event => updateOperation(index, { targetId: event.target.value })}>{objects.map(object => <option value={object.archonId} key={object.archonId}>{objectLabel(object)} / {object.archonId}</option>)}</select><div className="command-payload-fields">{operationKeys(operation.type).map(key => <label key={key}>{key}<input type="number" step="1" value={typeof operation.payload[key] === 'number' ? String(operation.payload[key]) : ''} onChange={event => updatePayload(index, key, event.target.value)} /></label>)}</div></div>)}{reviewErrors.length > 0 && <div className="command-review-errors">{reviewErrors.map(item => <small key={item}>{item}</small>)}</div>}</div>}
      <div className="command-checklist">{preview.checklist.map(item => <span key={item.stage} className={item.status.toLowerCase()}><b>{item.stage}</b><small>{item.status}</small></span>)}</div>
      {blockers.length > 0 && <div className="command-lock"><LockKeyhole size={15}/><span>{blockers.join(' - ')}</span></div>}
    </div>}
    <div className="command-submit-gate">
      <div className="command-submit-gate-head"><div><small>GOVERNED SUBMIT GATE</small><b>{gate.title}</b><span>{gate.detail}</span></div><strong className={gate.status.toLowerCase()}>{gate.status}</strong></div>
      <div className="command-flow">{flow.map((item, index) => <span key={item} className={preview && index < 3 ? 'pass' : index === 4 ? 'locked' : ''}>{item}</span>)}</div>
      <div className="command-resolution-actions">
        {activeChangeSet && <button onClick={focusActiveChangeSet}>Review active ChangeSet</button>}
        <button onClick={() => void refreshProjectState()} disabled={busy}><RefreshCw size={13}/>Refresh project state</button>
        <button className="command-create" onClick={() => void createProposal()} disabled={!canCreate || busy}>{busy && canCreate ? <Loader2 size={15} className="spin"/> : null}{gate.actionLabel}</button>
      </div>
    </div>
  </section>;
}
