'use client';

import { useMemo, useState } from 'react';

export type VersionSnapshotObject = {
  archonId?: string;
  objectType?: string;
  revision?: number;
  parameters?: Record<string, unknown>;
};

export type VersionRecord = {
  id: string;
  versionNumber: number;
  parentVersionId?: string | null;
  approvedChangeSetId?: string | null;
  createdAt?: string | Date;
  snapshot?: {
    schemaVersion?: number;
    canonicalObjects?: VersionSnapshotObject[];
    committedChangeSet?: {
      id?: string;
      intentSummary?: string;
      operations?: Record<string, unknown>[];
    };
  } | null;
};

type DiffSummary = {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
};

function snapshotObjects(version: VersionRecord | null) {
  return version?.snapshot?.canonicalObjects ?? [];
}

function diffVersions(base: VersionRecord | null, target: VersionRecord | null): DiffSummary {
  const before = new Map(snapshotObjects(base).filter(item => item.archonId).map(item => [item.archonId as string, item]));
  const after = new Map(snapshotObjects(target).filter(item => item.archonId).map(item => [item.archonId as string, item]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;

  for (const [id, item] of after) {
    const previous = before.get(id);
    if (!previous) {
      added.push(id);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(item)) changed.push(id);
    else unchanged += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return { added, removed, changed, unchanged };
}

export function VersionTimeline({ versions, currentApprovedVersionId }: { versions: VersionRecord[]; currentApprovedVersionId?: string | null }) {
  const ordered = useMemo(() => [...versions].sort((a, b) => b.versionNumber - a.versionNumber), [versions]);
  const [targetId, setTargetId] = useState<string | null>(ordered[0]?.id ?? null);
  const target = ordered.find(version => version.id === targetId) ?? ordered[0] ?? null;
  const base = target ? ordered.find(version => version.id === target.parentVersionId) ?? ordered.find(version => version.versionNumber === target.versionNumber - 1) ?? null : null;
  const diff = useMemo(() => diffVersions(base, target), [base, target]);

  if (!ordered.length) {
    return <div className="version-empty"><h3>No approved versions yet</h3><p>Approved immutable versions will appear here.</p></div>;
  }

  return <div className="version-explorer">
    <aside className="version-list">
      <div className="version-list-head"><b>Approved History</b><small>{ordered.length} immutable version{ordered.length === 1 ? '' : 's'}</small></div>
      {ordered.map(version => {
        const current = version.id === currentApprovedVersionId;
        const active = version.id === target?.id;
        return <button key={version.id} className={`version-card${active ? ' active' : ''}`} onClick={() => setTargetId(version.id)}>
          <span className="version-node" />
          <span><b>Version {version.versionNumber}</b><small>{version.snapshot?.committedChangeSet?.intentSummary ?? 'Approved project snapshot'}</small></span>
          {current && <em>CURRENT</em>}
        </button>;
      })}
    </aside>
    <section className="version-detail">
      <div className="version-detail-head"><div><span>IMMUTABLE SNAPSHOT</span><h2>Version {target?.versionNumber}</h2><p>{target?.snapshot?.committedChangeSet?.intentSummary ?? 'Approved project state'}</p></div><div className="version-id"><small>Version ID</small><code>{target?.id.slice(0, 8)}</code></div></div>
      <div className="version-stats">
        <article><small>Objects</small><b>{snapshotObjects(target).length}</b></article>
        <article><small>Changed</small><b>{diff.changed.length}</b></article>
        <article><small>Added</small><b>{diff.added.length}</b></article>
        <article><small>Removed</small><b>{diff.removed.length}</b></article>
      </div>
      <div className="version-compare">
        <div><span>COMPARE</span><h3>{base ? `Version ${base.versionNumber} → Version ${target?.versionNumber}` : 'Initial approved version'}</h3></div>
        <small>{diff.unchanged} unchanged canonical objects</small>
      </div>
      <div className="version-diff-grid">
        <DiffColumn title="Changed objects" items={diff.changed} empty="No object parameter changes" />
        <DiffColumn title="Added objects" items={diff.added} empty="No objects added" />
        <DiffColumn title="Removed objects" items={diff.removed} empty="No objects removed" />
      </div>
      <details className="snapshot-details"><summary>Snapshot metadata</summary><pre>{JSON.stringify({schemaVersion:target?.snapshot?.schemaVersion,approvedChangeSetId:target?.approvedChangeSetId,parentVersionId:target?.parentVersionId,operations:target?.snapshot?.committedChangeSet?.operations ?? []},null,2)}</pre></details>
    </section>
  </div>;
}

function DiffColumn({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="version-diff-column"><b>{title}</b>{items.length ? items.map(item => <code key={item}>{item}</code>) : <small>{empty}</small>}</section>;
}
