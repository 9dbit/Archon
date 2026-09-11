'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';

export type LiveChangeSet = {
  id: string;
  intentSummary: string;
  state: string;
};

export type ValidationFinding = {
  id: string;
  changeSetId: string;
  status: string;
};

type ChangeSetBarProps = {
  changeSet?: LiveChangeSet | null;
  findings?: ValidationFinding[];
  onCommitted?: () => Promise<void> | void;
};

export function ChangeSetBar({ changeSet, findings = [], onCommitted }: ChangeSetBarProps){
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [localState,setLocalState] = useState(changeSet?.state ?? 'NONE');

  if(!changeSet) return null;
  const changeSetId = changeSet.id;
  const intentSummary = changeSet.intentSummary;

  const pass = findings.filter((finding)=>finding.status === 'PASS').length;
  const warning = findings.filter((finding)=>finding.status === 'WARNING').length;
  const blocker = findings.filter((finding)=>finding.status === 'BLOCKER' || finding.status === 'CRITICAL').length;
  const isCommitted = localState === 'COMMITTED';
  const isReviewable = ['NEEDS_REVIEW','APPROVED'].includes(localState);

  async function approve(){
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/changesets/${changeSetId}/approve`, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ reviewer:'ARCHON User', note:'Approved from Checkpoint D workspace.' })
      });
      const payload = await response.json();
      if(!response.ok) throw new Error(payload.error ?? 'APPROVAL_FAILED');
      setLocalState('COMMITTED');
      await onCommitted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'APPROVAL_FAILED');
    } finally {
      setBusy(false);
    }
  }

  if(isCommitted) return <div className="changeset-bar committed">
    <div><CheckCircle2 size={16}/><b>CHANGE COMMITTED</b><small>{changeSetId.slice(0,8)}</small><p>Immutable project version created successfully.</p></div>
  </div>;

  return <div className="changeset-bar">
    <div><span className="status-dot"/><b>PROPOSED CHANGE</b><small>{changeSetId.slice(0,8)}</small><p>{intentSummary}</p>{error && <em className="changeset-error">{error}</em>}</div>
    <div className="validation-count"><span>{pass} ✓</span><span>{warning} ⚠</span>{blocker>0 && <span>{blocker} ⛔</span>}</div>
    <button>Preview Changes</button><button>Edit</button><button className="approve" disabled={!isReviewable || blocker>0 || busy} onClick={approve}>{busy?<><Loader2 size={15} className="spin"/>Approving...</>:'Approve'}</button><button className="discard" disabled={busy} onClick={()=>setLocalState('REJECTED')}><XCircle size={15}/>Discard</button>
  </div>;
}
