import type { CanonicalObject } from './canonical-3d-viewport';
import type { ChangeOperation } from './changeset-bar';

type Tuple = [number, number, number];
type Geometry = { position: Tuple; size: Tuple };
export type GeometryDiffRow = { object: CanonicalObject; before: Geometry; after: Geometry; operations: ChangeOperation[]; fields: string[] };

function tuple(value: unknown): Tuple | null {
  return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item)) ? [...value] as Tuple : null;
}

function geometryOf(object: CanonicalObject): Geometry | null {
  const position = tuple(object.parameters?.positionMm);
  const size = tuple(object.parameters?.sizeMm);
  return position && size ? { position, size } : null;
}

function apply(base: Geometry, operation: ChangeOperation): Geometry {
  const position: Tuple = [...base.position];
  const size: Tuple = [...base.size];
  if (operation.type === 'MOVE') {
    position[0] += typeof operation.payload.deltaXmm === 'number' ? operation.payload.deltaXmm : 0;
    position[1] += typeof operation.payload.deltaYmm === 'number' ? operation.payload.deltaYmm : 0;
    position[2] += typeof operation.payload.deltaZmm === 'number' ? operation.payload.deltaZmm : 0;
  }
  if (operation.type === 'UPDATE') {
    if (typeof operation.payload.widthMm === 'number') size[0] = operation.payload.widthMm;
    if (typeof operation.payload.heightMm === 'number') size[1] = operation.payload.heightMm;
    if (typeof operation.payload.depthMm === 'number') size[2] = operation.payload.depthMm;
  }
  return { position, size };
}

function changedFields(before: Geometry, after: Geometry) {
  const fields: string[] = [];
  ['X', 'Y', 'Z'].forEach((field, index) => { if (before.position[index] !== after.position[index]) fields.push(field); });
  ['W', 'H', 'D'].forEach((field, index) => { if (before.size[index] !== after.size[index]) fields.push(field); });
  return fields;
}

export function buildGeometryDiff(objects: CanonicalObject[], operations: ChangeOperation[]) {
  const rows: GeometryDiffRow[] = [];
  const unavailableTargetIds = new Set(operations.map(operation => operation.targetId));
  for (const object of objects) {
    const objectOperations = operations.filter(operation => operation.targetId === object.archonId);
    if (!objectOperations.length || objectOperations.some(operation => !['MOVE', 'UPDATE'].includes(operation.type))) continue;
    const before = geometryOf(object);
    if (!before) continue;
    // Always start from canonical geometry, never from a previous render's preview.
    const after = objectOperations.reduce((geometry, operation) => apply(geometry, operation), before);
    if (!tuple(after.position) || !tuple(after.size)) continue;
    rows.push({ object, before, after, operations: objectOperations, fields: changedFields(before, after) });
    unavailableTargetIds.delete(object.archonId);
  }
  return { rows, unavailableTargetIds: [...unavailableTargetIds] };
}

export function formatGeometryTuple(value: Tuple) {
  return value.map(item => `${item} mm`).join(' / ');
}
