export type PlanSource = { projectId: string; versionId: string; mode: 'PREVIEW' | 'APPROVED_VERSION'; level: string; changeSetId?: string };
export type PlanObject = { archonId: string; revision: number; objectType: string; parameters: Record<string, unknown> | null; relationships: Record<string, unknown> | null };
export type SiteRectangle = { archonId: string; revision: number; boundsMm: [number, number, number, number] };
type Point = [number, number];
export type PlanEntity =
  | { kind: 'POLYLINE'; sourceId: string; revision: number; layer: string; closed: true; pointsMm: Point[] }
  | { kind: 'TEXT'; sourceId: string; revision: number; layer: string; positionMm: Point; text: string }
  | { kind: 'DIMENSION'; sourceId: string; revision: number; layer: string; startMm: Point; endMm: Point; axis: 'X' | 'Z'; measuredMm: number };
export type DwgInput = { schemaVersion: 1; source: PlanSource; units: 'mm'; coordinateMapping: 'ARCHON_XZ_TO_CAD_XY'; entities: PlanEntity[]; excludedObjectIds: string[]; checklist: { category: string; status: 'PASS' | 'WARNING'; evidence: string }[]; executionEnabled: false; reconciliation: 'PROPOSE_CHANGESET_ONLY' };
function required(value: string, code: string) { if (typeof value !== 'string' || !value.trim()) throw new Error(code); }
function tuple(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(item => typeof item === 'number' && Number.isFinite(item))) throw new Error('DWG_GEOMETRY_INVALID');
  return [...value] as [number, number, number];
}
function rectangle(x: number, z: number, width: number, depth: number): Point[] {
  return [[x-width/2,z-depth/2],[x+width/2,z-depth/2],[x+width/2,z+depth/2],[x-width/2,z+depth/2]];
}
// Pure snapshot serialization; source mode is descriptive, never proof of approval.
export function createDwgInput(source: PlanSource, site: SiteRectangle, objects: PlanObject[]): DwgInput {
  required(source.projectId,'DWG_PROJECT_REQUIRED'); required(source.versionId,'DWG_VERSION_REQUIRED');
  required(source.level,'DWG_LEVEL_REQUIRED'); required(site.archonId,'DWG_SITE_REQUIRED');
  if (!['PREVIEW','APPROVED_VERSION'].includes(source.mode)) throw new Error('DWG_SOURCE_MODE_INVALID');
  if (source.mode === 'PREVIEW') required(source.changeSetId ?? '', 'DWG_PREVIEW_CHANGESET_REQUIRED');
  if (!Number.isInteger(site.revision) || site.revision < 1) throw new Error('DWG_SITE_REVISION_INVALID');
  const bounds = site.boundsMm;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) throw new Error('DWG_SITE_INVALID');
  const [x0,z0,x1,z1] = bounds;
  const entities: PlanEntity[] = [{kind:'POLYLINE',sourceId:site.archonId,revision:site.revision,layer:'ARCHON_SITE',closed:true,pointsMm:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]},
    {kind:'DIMENSION',sourceId:site.archonId,revision:site.revision,layer:'ARCHON_DIMS',startMm:[x0,z0],endMm:[x1,z0],axis:'X',measuredMm:x1-x0},
    {kind:'DIMENSION',sourceId:site.archonId,revision:site.revision,layer:'ARCHON_DIMS',startMm:[x0,z0],endMm:[x0,z1],axis:'Z',measuredMm:z1-z0}];
  const seen = new Set([site.archonId]); const excludedObjectIds: string[] = [];
  for (const object of objects) {
    required(object.archonId,'DWG_OBJECT_ID_REQUIRED');
    if (seen.has(object.archonId)) throw new Error('DWG_DUPLICATE_SOURCE_ID'); seen.add(object.archonId);
    if (!['WALL','ROOM'].includes(object.objectType)) { excludedObjectIds.push(object.archonId); continue; }
    if (object.relationships?.level !== source.level) throw new Error('DWG_LEVEL_MISMATCH');
    if (!Number.isInteger(object.revision) || object.revision < 1) throw new Error('DWG_REVISION_INVALID');
    const p = object.parameters ?? {};
    // This slice only supports canonical axis-aligned boxes, without external transforms.
    if (['rotation','rotationDeg','rotationRad','quaternion','transform'].some(key => key in p)) throw new Error('DWG_TRANSFORM_UNSUPPORTED');
    const [x,,z] = tuple(p.positionMm); const [width,height,depth] = tuple(p.sizeMm);
    if (width <= 0 || height <= 0 || depth <= 0) throw new Error('DWG_SIZE_INVALID');
    const points = rectangle(x,z,width,depth);
    if (points.some(([px,pz])=>px<x0||px>x1||pz<z0||pz>z1)) throw new Error('DWG_OUTSIDE_SITE');
    if (object.objectType === 'WALL') entities.push({kind:'POLYLINE',sourceId:object.archonId,revision:object.revision,layer:'ARCHON_WALLS',closed:true,pointsMm:points});
    else {
      if (typeof p.label !== 'string' || !p.label.trim() || /[\u0000-\u001f]/.test(p.label)) throw new Error('DWG_ROOM_LABEL_INVALID');
      entities.push({kind:'TEXT',sourceId:object.archonId,revision:object.revision,layer:'ARCHON_ROOMS',positionMm:[x,z],text:p.label});
      entities.push({kind:'DIMENSION',sourceId:object.archonId,revision:object.revision,layer:'ARCHON_DIMS',startMm:points[0],endMm:points[1],axis:'X',measuredMm:width},
        {kind:'DIMENSION',sourceId:object.archonId,revision:object.revision,layer:'ARCHON_DIMS',startMm:points[0],endMm:points[3],axis:'Z',measuredMm:depth});
    }
  }
  return {schemaVersion:1,source:{...source},units:'mm',coordinateMapping:'ARCHON_XZ_TO_CAD_XY',entities,excludedObjectIds,
    checklist:[{category:'geometry',status:'PASS',evidence:'Finite axis-aligned boxes inside supplied site rectangle; explicit single level.'},
      {category:'dimensions',status:'PASS',evidence:'Dimension values derived from source coordinates in millimetres.'},
      {category:'scope',status:excludedObjectIds.length?'WARNING':'PASS',evidence:'Only site, walls, room labels and dimensions supported; excluded IDs recorded.'},
      {category:'design/materials/rules',status:'WARNING',evidence:'Serialization does not validate circulation, materials, topology or construction compliance.'},
      {category:'approval',status:'WARNING',evidence:'Source reference is descriptive. Existing governance must independently verify approval and freshness before any execution.'}],
    executionEnabled:false,reconciliation:'PROPOSE_CHANGESET_ONLY'};
}
export function serializeDwgInput(input: DwgInput): string { return JSON.stringify(input); }
