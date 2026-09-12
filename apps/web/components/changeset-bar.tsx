'use client';

import { CheckCircle2, Loader2, RotateCcw, Save, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ChangeOperation = { type: string; targetId: string; payload: Record<string, unknown> };
export type LiveChangeSet = { id: string; intentSummary: string; state: string; baseVersionId?: string | null; operations?: ChangeOperation[] };
export type ValidationFinding = { id: string; changeSetId: string; status: string };

type ChangeSetBarProps = {
  changeSet?: LiveChangeSet | null;
  findings?: ValidationFinding[];
  currentApprovedVersionId?: string | null;
  onCommitted?: () => Promise<void> | void;
};

const REVIEWABLE_STATES = ['NEEDS_REVIEW', 'APPROVED'];
const EDITABLE_STATES = ['DRAFT', 'PROPOSED', 'SANDBOXED', 'VALIDATION_FAILED', 'NEEDS_REVIEW', 'APPROVED'];

export function ChangeSetBar({ changeSet, findings = [], currentApprovedVersionId = null, onCommitted }: ChangeSetBarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftIntent, setDraftIntent] = useState(changeSet?.intentSummary ?? '');
  const [localState, setLocalState] = useState(changeSet?.state ?? 'NONE');

  useEffect(() => {
    setLocalState(changeSet?.state ?? 'NONE');
    setDraftIntent(changeSet?.intentSummary ?? '');
    setEditing(false);
  }, [changeSet?.id, changeSet?.state, changeSet?.intentSummary]);

  if (!changeSet) return null;

  const currentChangeSet = changeSet;
  const changeSetId = currentChangeSet.id;
  const changeSetOperations = currentChangeSet.operations ?? [];
  const pass = findings.filter((finding) => finding.status === 'PASS').length;
  const warning = findings.filter((finding) => finding.status === 'WARNING').length;
  const blocker = findings.filter((finding) => finding.status === 'BLOCKER' || finding.status === 'CRITICAL').length;
  const isReviewable = REVIEWABLE_STATES.includes(localState);
  const isEditable = EDITABLE_STATES.includes(localState);
  const isStale = Boolean(isEditable && currentApprovedVersionId && currentChangeSet.baseVersionId && currentApprovedVersionId !== currentChangeSet.baseVersionId);

  async function mutate(path: string, body: Record<string, string>, successState: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/changesets/${changeSetId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `${path.toUpperCase()}_FAILED`);
      setLocalState(successState);
      await onCommitted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${path.toUpperCase()}_FAILED`);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/changesets/${changeSetId}/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          actor: 'ARCHON User',
          intentSummary: draftIntent,
          operations: changeSetOperations
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'EDIT_FAILED');
      setLocalState('NEEDS_REVIEW');
      setEditing(false);
      await onCommitted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'EDIT_FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function rebase() {
    await mutate('rebase', { actor: 'ARCHON User' }, 'NEEDS_REVIEW');
  }

  if (localState === 'COMMITTED') {
    return <div className="changeset-bar committed"><div><CheckCircle2 size={16} /><b>CHANGE COMMITTED</b><small>{changeSetId.slice(0, 8)}</small><p>Immutable project version created successfully.</p></div></div>;
  }

  if (localState === 'REJECTED') {
    return <div className="changeset-bar committed"><div><XCircle size={16} /><b>PROPOSAL DISCARDED</b><small>{changeSetId.slice(0, 8)}</small><p>Approved Building Graph remained unchanged.</p></div></div>;
  }

  return <div className="changeset-bar"><div><span className="status-dot" /><b>{isStale ? 'STALE PROPOSED CHANGE' : 'PROPOSED CHANGE'}</b><small>{changeSetId.slice(0, 8)}</small>{editing ? <input className="changeset-edit" value={draftIntent} onChange={(event) => setDraftIntent(event.target.value)} aria-label="Edit ChangeSet intent" /> : <p>{currentChangeSet.intentSummary}</p>}{isStale && <em className="changeset-error">Project version changed. Rebase before approval.</em>}{error && <em className="changeset-error">{error}</em>}</div><div className="validation-count"><span>{pass} ✓</span><span>{warning} ⚠</span>{blocker > 0 && <span>{blocker} ⛔</span>}</div><button>Preview Changes</button>{isStale && <button disabled={busy} onClick={() => void rebase()}><RotateCcw size={15} />Rebase</button>}{editing ? <button disabled={busy} onClick={() => void saveEdit()}><Save size={15} />Save</button> : <button disabled={!isEditable || busy} onClick={() => setEditing(true)}>Edit</button>}<button className="approve" disabled={!isReviewable || isStale || blocker > 0 || busy} onClick={() => void mutate('approve', { reviewer: 'ARCHON User', note: 'Approved from governed workspace preview.' }, 'COMMITTED')}>{busy ? <><Loader2 size={15} className="spin" />Working...</> : 'Approve'}</button><button className="discard" disabled={busy} onClick={() => void mutate('discard', { actor: 'ARCHON User', reason: 'Discarded from governed workspace preview.' }, 'REJECTED')}><XCircle size={15} />Discard</button></div>;
}
