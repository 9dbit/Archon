'use client';

import type { ChangeOperation, ValidationFinding } from './changeset-bar';
import type { CanonicalObject } from './canonical-3d-viewport';
import { buildGeometryDiff, formatGeometryTuple, type GeometryDiffRow } from './changeset-preview-geometry';

type Props = {
  objects: CanonicalObject[];
  operations: ChangeOperation[];
  findings?: ValidationFinding[];
  selectedId?: string | null;
  onSelect?: (object: CanonicalObject | null) => void;
  mode?: '3d' | 'layout';
  variant?: 'changeset' | 'reviewed';
};

function labelOf(object: CanonicalObject) {
  const label = object.parameters?.label;
  return typeof label === 'string' ? label : object.archonId;
}

function DiffValues({ row }: { row: GeometryDiffRow }) {
  return <>
    <div className="geometry-diff-target"><b>{labelOf(row.object)}</b><small>{row.object.archonId} / {row.operations.map(operation => operation.type).join(' + ')}</small></div>
    <div><small>BEFORE</small><span>Pos (X/Y/Z): {formatGeometryTuple(row.before.position)}</span><span>Size (W/H/D): {formatGeometryTuple(row.before.size)}</span></div>
    <div><small>AFTER</small><span>Pos (X/Y/Z): {formatGeometryTuple(row.after.position)}</span><span>Size (W/H/D): {formatGeometryTuple(row.after.size)}</span></div>
    <div className="geometry-diff-fields">{row.fields.length ? `Changed: ${row.fields.join(' / ')}` : 'No geometric delta'}</div>
  </>;
}

export function ChangeSetPreviewPanel({ objects, operations, findings = [], selectedId = null, onSelect, mode = '3d', variant = 'changeset' }: Props) {
  if (!operations.length) return null;
  const { rows, unavailableTargetIds } = buildGeometryDiff(objects, operations);
  const reviewed = variant === 'reviewed';
  const id = reviewed ? 'command-reviewed-preview' : 'changeset-preview';
  const pass = findings.filter(item => item.status === 'PASS').length;
  const warning = findings.filter(item => item.status === 'WARNING').length;
  const blocker = findings.filter(item => item.status === 'BLOCKER' || item.status === 'CRITICAL').length;

  return <section id={id} className={`geometry-diff ${reviewed ? 'geometry-diff-reviewed' : ''}`} aria-labelledby={`${id}-title`}>
    <div className="geometry-diff-head">
      <div><small>{reviewed ? 'COMMAND CENTER / LOCAL PREVIEW' : `E7.4 GOVERNED PREVIEW / ${mode.toUpperCase()}`}</small><strong id={`${id}-title`}>{reviewed ? 'Reviewed Before / After Diff' : 'Before / After ChangeSet Diff'}</strong></div>
      <div className="geometry-diff-counts"><span>{operations.length} ops</span><span>{rows.length} objects</span>{reviewed ? <span>Validation pending</span> : <><span>{pass} pass</span><span>{warning} warnings</span>{blocker > 0 && <span>{blocker} blockers</span>}</>}</div>
    </div>
    <div className="geometry-diff-rows">{rows.map(row => onSelect ?
      <button type="button" key={row.object.archonId} onClick={() => onSelect(row.object)} className={`geometry-diff-row ${row.object.archonId === selectedId ? 'selected' : ''}`}><DiffValues row={row}/></button> :
      <div key={row.object.archonId} className="geometry-diff-row"><DiffValues row={row}/></div>
    )}</div>
    {!rows.length && <p className="geometry-diff-notice">No previewable canonical geometry targets.</p>}
    {unavailableTargetIds.length > 0 && <p className="geometry-diff-notice">Geometry diff unavailable for: {unavailableTargetIds.join(', ')}. Canonical geometry or a supported operation is missing.</p>}
    <small className="geometry-diff-note">{reviewed ? 'Local geometry diff only. Reviewed operations require server validation. No approval or APS/DWG execution.' : 'Validation summary belongs to this active ChangeSet. Preview derives from approved canonical geometry plus proposed operations only.'}</small>
  </section>;
}
