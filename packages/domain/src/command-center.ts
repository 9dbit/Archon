export type CommandCenterObject = {
  archonId: string;
  objectType: string;
  parameters?: Record<string, unknown> | null;
  relationships?: Record<string, unknown> | null;
};

export type CommandCenterOperation = {
  type: 'MOVE' | 'UPDATE';
  targetId: string;
  payload: Record<string, number>;
};

export type CommandCenterPreview = {
  schemaVersion: 1;
  state: 'SANDBOX_PREVIEW_READY' | 'DRAWING_SANDBOX_PLAN_READY' | 'NEEDS_TARGET_REVIEW' | 'COMMAND_REQUIRES_MEASUREMENT' | 'COMMAND_REQUIRES_ACTION';
  intent: { sourcePrompt: string; summary: string; normalizedAction: string; targetArchonId: string | null; targetLabel: string | null; measurementMm: number | null };
  proposedChangeSet: { intentSummary: string; operations: CommandCenterOperation[]; canSubmit: boolean; blockedBy: string[] };
  drawingPlan: { mode: 'ARCHON_TO_DWG_PREVIEW_ONLY'; includes: string[]; layerMapping: Record<string, string>; externalSync: 'LOCKED'; apsExecutionEnabled: false };
  targetCandidates: Array<{ archonId: string; label: string; objectType: string }>;
  checklist: Array<{ stage: string; status: 'PASS' | 'PENDING' | 'LOCKED' | 'BLOCKED'; evidence: string }>;
  governance: { canonicalSource: 'ARCHON_BUILDING_GRAPH'; approvedGraphMutated: false; approvalGranted: false; immutableVersionCreated: false; externalSyncExecuted: false; realApsJobSubmitted: false };
};

const MAX_PROMPT = 600;
const MAX_MOVE_MM = 10000;
const MAX_DIMENSION_MM = 50000;
const DISTANCE = /(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i;
const activeBlock = (id?: string | null) => id ? ['ACTIVE_CHANGESET_EXISTS'] : [];
const words = (value: string, keys: string[]) => keys.some(key => value.includes(key));
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const labelOf = (object: CommandCenterObject) => typeof object.parameters?.label === 'string' ? object.parameters.label : object.archonId;
const candidate = (object: CommandCenterObject) => ({ archonId: object.archonId, label: labelOf(object), objectType: object.objectType });
function amountMm(prompt: string) {
  const match = prompt.match(DISTANCE);
  if (!match) return null;
  const raw = Number(match[1].replace(',', '.'));
  const mm = match[2].toLowerCase() === 'm' ? raw * 1000 : match[2].toLowerCase() === 'cm' ? raw * 10 : raw;
  if (!Number.isFinite(mm) || mm <= 0) return null;
  return Math.round(mm);
}
function drawingIntent(prompt: string) {
  return words(prompt.toLowerCase(), ['dwg','cad','drawing','gambar','denah','dimension','dimensi','label','layer','boundary','batas site','site boundary','regenerate','update']);
}
function moveIntent(prompt: string) {
  return words(prompt.toLowerCase(), ['move','geser','pindah','shift','offset','kiri','kanan','left','right','north','south','east','west','utara','selatan','timur','barat']);
}
function resizeIntent(prompt: string) {
  return words(prompt.toLowerCase(), ['resize','ubah','set','lebarkan','sempitkan','perbesar','perkecil','width','lebar','height','tinggi','depth','kedalaman','panjang','kitchen','dapur']);
}
function targetObjects(prompt: string, objects: CommandCenterObject[], explicitTarget?: string) {
  if (explicitTarget) {
    const found = objects.find(object => object.archonId === explicitTarget);
    return found ? [found] : [];
  }
  const p = prompt.toLowerCase();
  const byToken = (tokens: string[]) => objects.filter(object => tokens.some(token => `${object.archonId} ${labelOf(object)}`.toLowerCase().includes(token)));
  if (words(p, ['kitchen','dapur'])) return byToken(['kitchen']);
  if (words(p, ['dining','makan'])) return byToken(['dining']);
  if (words(p, ['north wall','dinding utara','wall north'])) return byToken(['wall_north','north wall']);
  if (words(p, ['south wall','dinding selatan','wall south'])) return byToken(['wall_south','south wall']);
  if (words(p, ['east wall','dinding timur','wall east'])) return byToken(['wall_east','east wall']);
  if (words(p, ['west wall','dinding barat','wall west'])) return byToken(['wall_west','west wall']);
  if (words(p, ['wall','dinding'])) return objects.filter(object => object.objectType === 'WALL');
  if (words(p, ['slab','site','boundary','batas'])) return objects.filter(object => object.objectType === 'SLAB');
  return [];
}
function movePayload(prompt: string, target: CommandCenterObject, mm: number): Record<string, number> | null {
  if (mm > MAX_MOVE_MM) return null;
  const p = prompt.toLowerCase();
  if (words(p, ['left','kiri','west','barat'])) return { deltaXmm: -mm };
  if (words(p, ['right','kanan','east','timur'])) return { deltaXmm: mm };
  if (words(p, ['north','utara','forward','depan'])) return { deltaZmm: -mm };
  if (words(p, ['south','selatan','back','belakang'])) return { deltaZmm: mm };
  if (target.archonId.includes('wall_north')) return { deltaZmm: -mm };
  if (target.archonId.includes('wall_south')) return { deltaZmm: mm };
  if (target.archonId.includes('wall_east')) return { deltaXmm: mm };
  if (target.archonId.includes('wall_west')) return { deltaXmm: -mm };
  return null;
}
function updatePayload(prompt: string, mm: number): Record<string, number> | null {
  if (mm > MAX_DIMENSION_MM) return null;
  const p = prompt.toLowerCase();
  if (words(p, ['height','tinggi'])) return { heightMm: mm };
  if (words(p, ['depth','kedalaman','panjang','length'])) return { depthMm: mm };
  return { widthMm: mm };
}
function checklist(state: CommandCenterPreview['state'], operations: CommandCenterOperation[]) {
  const hasOperation = operations.length > 0;
  return [
    { stage: 'Intent', status: state === 'COMMAND_REQUIRES_ACTION' ? 'BLOCKED' : 'PASS', evidence: 'Prompt normalized into an ARCHON-governed sandbox intent.' },
    { stage: 'Proposed ChangeSet', status: hasOperation ? 'PASS' : 'PENDING', evidence: hasOperation ? 'Preview operations target canonical Building Graph IDs.' : 'Drawing-only command creates no graph operation yet.' },
    { stage: 'Sandbox/Preview', status: 'PASS', evidence: 'Preview is computed without mutating approved Building Graph data.' },
    { stage: 'Validation', status: hasOperation ? 'PASS' : 'PENDING', evidence: hasOperation ? 'Basic geometric bounds and target resolution passed.' : 'Validation waits for a concrete geometric operation.' },
    { stage: 'Review/Edit', status: 'PENDING', evidence: 'Operator can edit or discard before approval.' },
    { stage: 'Approval', status: 'LOCKED', evidence: 'No production approval is granted by command preview.' },
    { stage: 'Immutable Version', status: 'LOCKED', evidence: 'Version creation requires existing ChangeSet approval flow.' },
    { stage: 'External Sync', status: 'LOCKED', evidence: 'APS/AutoCAD execution stays disabled.' }
  ] as CommandCenterPreview['checklist'];
}

export function createCommandCenterPreview(input: { prompt: string; canonicalObjects: CommandCenterObject[]; targetArchonId?: string; currentApprovedVersionId?: string | null; activeChangeSetId?: string | null }): CommandCenterPreview {
  const prompt = clean(input.prompt ?? '');
  if (!prompt || prompt.length > MAX_PROMPT) throw new Error('COMMAND_CENTER_PROMPT_INVALID');
  const objects = [...(input.canonicalObjects ?? [])];
  const targets = targetObjects(prompt, objects, input.targetArchonId);
  const candidates = targets.map(candidate);
  const mm = amountMm(prompt);
  const isMove = moveIntent(prompt);
  const isResize = resizeIntent(prompt);
  const isDrawing = drawingIntent(prompt);
  let state: CommandCenterPreview['state'] = isDrawing ? 'DRAWING_SANDBOX_PLAN_READY' : 'COMMAND_REQUIRES_ACTION';
  let operation: CommandCenterOperation | null = null;
  let normalizedAction = isDrawing ? 'DWG_DRAWING_PREVIEW' : 'UNRESOLVED';
  if ((isMove || isResize) && !mm) state = 'COMMAND_REQUIRES_MEASUREMENT';
  else if (isMove || isResize) {
    if (targets.length !== 1) state = 'NEEDS_TARGET_REVIEW';
    else if (isMove) {
      const payload = movePayload(prompt, targets[0], mm!);
      if (!payload) state = 'COMMAND_REQUIRES_ACTION';
      else { operation = { type: 'MOVE', targetId: targets[0].archonId, payload }; normalizedAction = 'MOVE_CANONICAL_OBJECT'; state = 'SANDBOX_PREVIEW_READY'; }
    } else {
      const payload = updatePayload(prompt, mm!);
      if (!payload) state = 'COMMAND_REQUIRES_ACTION';
      else { operation = { type: 'UPDATE', targetId: targets[0].archonId, payload }; normalizedAction = 'UPDATE_CANONICAL_DIMENSION'; state = 'SANDBOX_PREVIEW_READY'; }
    }
  }
  const operations = operation ? [operation] : [];
  const blockers = [...activeBlock(input.activeChangeSetId), ...(operations.length ? [] : ['NO_PROPOSED_GRAPH_OPERATION'])];
  const target = operation ? targets[0] : targets.length === 1 ? targets[0] : null;
  const intentSummary = operation ? `Command Center · ${prompt}` : `Command Center sandbox preview · ${prompt}`;
  return {
    schemaVersion: 1,
    state,
    intent: { sourcePrompt: prompt, summary: intentSummary, normalizedAction, targetArchonId: target?.archonId ?? null, targetLabel: target ? labelOf(target) : null, measurementMm: mm },
    proposedChangeSet: { intentSummary, operations, canSubmit: operations.length > 0 && blockers.length === 0, blockedBy: blockers },
    drawingPlan: { mode: 'ARCHON_TO_DWG_PREVIEW_ONLY', includes: ['siteBoundary','walls','roomLabels','dimensions','layerMapping'], layerMapping: { siteBoundary: 'ARCHON_SITE', walls: 'ARCHON_WALLS', roomLabels: 'ARCHON_ROOMS', dimensions: 'ARCHON_DIMS' }, externalSync: 'LOCKED', apsExecutionEnabled: false },
    targetCandidates: candidates,
    checklist: checklist(state, operations),
    governance: { canonicalSource: 'ARCHON_BUILDING_GRAPH', approvedGraphMutated: false, approvalGranted: false, immutableVersionCreated: false, externalSyncExecuted: false, realApsJobSubmitted: false }
  };
}
