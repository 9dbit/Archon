import {
  createPromptLayoutPreview,
  type LayoutCandidate,
  type LayoutDoorProposal,
  type LayoutProgram,
  type LayoutRect,
  type LayoutWallSegment
} from './prompt-layout';

export type LayoutCandidateId = LayoutCandidate['id'];

export type LayoutRoomReviewEdit = {
  roomId: string;
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  depthMm?: number;
};

export type DrawingIRFinding = {
  code: string;
  severity: 'PASS' | 'WARNING' | 'BLOCKER';
  message: string;
  entityId?: string;
};

export type DrawingIROperation =
  | {
      op: 'CREATE_ROOM';
      id: string;
      roomId: string;
      label: string;
      kind: string;
      originMm: [number, number, 0];
      widthMm: number;
      depthMm: number;
    }
  | {
      op: 'CREATE_WALL';
      id: string;
      startMm: [number, number, 0];
      endMm: [number, number, 0];
      thicknessMm: number;
      role: 'PERIMETER' | 'PARTITION';
    }
  | {
      op: 'CREATE_DOOR';
      id: string;
      roomId: string;
      hostWallId: string;
      widthMm: number;
      positionMm: [number, number, 0];
      orientation: 'HORIZONTAL' | 'VERTICAL';
    }
  | {
      op: 'CREATE_LABEL';
      id: string;
      roomId: string;
      text: string;
      positionMm: [number, number, 0];
    };

export type SketchUpDrawingIR = {
  schema: 'archon.sketchup-drawing-ir.v1';
  units: 'mm';
  coordinateSystem: 'SKETCHUP_XY_Z_UP';
  sourceCandidateId: LayoutCandidateId;
  operations: DrawingIROperation[];
  operationCount: number;
  deterministicFingerprint: string;
  mutation: 'none';
};

export type ProposedDrawChangeSet = {
  schema: 'archon.sketchup-draw-changeset-proposal.v1';
  id: string;
  state: 'PROPOSED' | 'BLOCKED';
  intentSummary: string;
  sourceCandidateId: LayoutCandidateId;
  operationCount: number;
  operations: Array<{
    operationId: string;
    action: 'CREATE';
    targetType: 'ROOM' | 'WALL' | 'DOOR' | 'LABEL';
    targetId: string;
    payload: DrawingIROperation;
  }>;
  approvalGranted: false;
  executable: false;
  mutation: 'none';
};

export type LayoutReviewProposal = {
  schema: 'archon.layout-review-proposal.v1';
  state: 'REVIEW_READY' | 'REVIEW_BLOCKED';
  mutation: 'none';
  sourcePrompt: string;
  program: LayoutProgram;
  selectedCandidateId: LayoutCandidateId;
  editsApplied: LayoutRoomReviewEdit[];
  reviewedCandidate: LayoutCandidate;
  validation: DrawingIRFinding[];
  drawingIR: SketchUpDrawingIR;
  proposedChangeSet: ProposedDrawChangeSet;
  checklist: Array<{
    stage: string;
    status: 'PASS' | 'PENDING' | 'LOCKED' | 'BLOCKED';
    evidence: string;
  }>;
  governance: {
    approvalGranted: false;
    sketchUpGeometryMutated: false;
    immutableVersionCreated: false;
    executionEnabled: false;
  };
};

const MIN_ROOM_DIMENSION_MM = 500;
const DEFAULT_DOOR_WIDTH_MM = 900;

function normalizeMm(value: number, field: string) {
  if (!Number.isFinite(value)) throw new Error(`DRAWING_IR_${field}_INVALID`);
  return Math.round(value);
}

function applyRoomEdits(candidate: LayoutCandidate, edits: LayoutRoomReviewEdit[]) {
  const byRoomId = new Map(candidate.rooms.map(room => [room.roomId, room]));
  const seen = new Set<string>();

  for (const edit of edits) {
    if (!edit || typeof edit.roomId !== 'string' || !byRoomId.has(edit.roomId)) {
      throw new Error('DRAWING_IR_UNKNOWN_ROOM_EDIT');
    }
    if (seen.has(edit.roomId)) throw new Error('DRAWING_IR_DUPLICATE_ROOM_EDIT');
    seen.add(edit.roomId);

    const room = byRoomId.get(edit.roomId)!;
    byRoomId.set(edit.roomId, {
      ...room,
      xMm: edit.xMm === undefined ? room.xMm : normalizeMm(edit.xMm, 'ROOM_X'),
      yMm: edit.yMm === undefined ? room.yMm : normalizeMm(edit.yMm, 'ROOM_Y'),
      widthMm: edit.widthMm === undefined ? room.widthMm : normalizeMm(edit.widthMm, 'ROOM_WIDTH'),
      depthMm: edit.depthMm === undefined ? room.depthMm : normalizeMm(edit.depthMm, 'ROOM_DEPTH')
    });
  }

  return candidate.rooms.map(room => byRoomId.get(room.roomId)!);
}

function wallKey(x1: number, y1: number, x2: number, y2: number) {
  const a = `${x1},${y1}`;
  const b = `${x2},${y2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildWalls(program: LayoutProgram, rooms: LayoutRect[]) {
  if (!program.footprint) return [] as LayoutWallSegment[];
  const walls = new Map<string, LayoutWallSegment>();
  const add = (x1Mm: number, y1Mm: number, x2Mm: number, y2Mm: number, role: LayoutWallSegment['role']) => {
    if (x1Mm === x2Mm && y1Mm === y2Mm) return;
    const key = wallKey(x1Mm, y1Mm, x2Mm, y2Mm);
    if (walls.has(key)) return;
    walls.set(key, {
      id: `WALL-${String(walls.size + 1).padStart(3, '0')}`,
      x1Mm,
      y1Mm,
      x2Mm,
      y2Mm,
      thicknessMm: program.wallThicknessMm,
      role
    });
  };

  const f = program.footprint;
  add(0, 0, f.widthMm, 0, 'PERIMETER');
  add(f.widthMm, 0, f.widthMm, f.depthMm, 'PERIMETER');
  add(f.widthMm, f.depthMm, 0, f.depthMm, 'PERIMETER');
  add(0, f.depthMm, 0, 0, 'PERIMETER');

  for (const room of rooms) {
    const x2 = room.xMm + room.widthMm;
    const y2 = room.yMm + room.depthMm;
    add(room.xMm, room.yMm, x2, room.yMm, 'PARTITION');
    add(x2, room.yMm, x2, y2, 'PARTITION');
    add(x2, y2, room.xMm, y2, 'PARTITION');
    add(room.xMm, y2, room.xMm, room.yMm, 'PARTITION');
  }

  return [...walls.values()];
}

function buildDoors(rooms: LayoutRect[]) {
  return rooms.map((room, index): LayoutDoorProposal => ({
    id: `DOOR-${String(index + 1).padStart(3, '0')}`,
    roomId: room.roomId,
    widthMm: Math.min(DEFAULT_DOOR_WIDTH_MM, Math.max(600, room.widthMm - 200)),
    xMm: room.xMm + Math.min(Math.max(room.widthMm / 2, 450), Math.max(450, room.widthMm - 450)),
    yMm: room.yMm,
    orientation: 'HORIZONTAL'
  }));
}

function horizontalContains(wall: LayoutWallSegment, x: number, y: number) {
  if (wall.y1Mm !== y || wall.y2Mm !== y) return false;
  const minX = Math.min(wall.x1Mm, wall.x2Mm);
  const maxX = Math.max(wall.x1Mm, wall.x2Mm);
  return x >= minX && x <= maxX;
}

function verticalContains(wall: LayoutWallSegment, x: number, y: number) {
  if (wall.x1Mm !== x || wall.x2Mm !== x) return false;
  const minY = Math.min(wall.y1Mm, wall.y2Mm);
  const maxY = Math.max(wall.y1Mm, wall.y2Mm);
  return y >= minY && y <= maxY;
}

function findHostWall(door: LayoutDoorProposal, walls: LayoutWallSegment[]) {
  return walls.find(wall => door.orientation === 'HORIZONTAL'
    ? horizontalContains(wall, door.xMm, door.yMm)
    : verticalContains(wall, door.xMm, door.yMm));
}

function roomsOverlap(a: LayoutRect, b: LayoutRect) {
  return a.xMm < b.xMm + b.widthMm
    && a.xMm + a.widthMm > b.xMm
    && a.yMm < b.yMm + b.depthMm
    && a.yMm + a.depthMm > b.yMm;
}

function validateReviewedGeometry(program: LayoutProgram, rooms: LayoutRect[], walls: LayoutWallSegment[], doors: LayoutDoorProposal[]) {
  const findings: DrawingIRFinding[] = [];
  const footprint = program.footprint;
  if (!footprint) return [{ code: 'FOOTPRINT_REQUIRED', severity: 'BLOCKER', message: 'Building footprint is required.' } satisfies DrawingIRFinding];

  const invalidSize = rooms.filter(room => room.widthMm < MIN_ROOM_DIMENSION_MM || room.depthMm < MIN_ROOM_DIMENSION_MM);
  findings.push(invalidSize.length
    ? { code: 'ROOM_DIMENSION_INVALID', severity: 'BLOCKER', message: `${invalidSize.length} room(s) are below the ${MIN_ROOM_DIMENSION_MM} mm minimum review dimension.` }
    : { code: 'ROOM_DIMENSIONS_VALID', severity: 'PASS', message: 'Reviewed room dimensions are positive and within the MVP minimum.' });

  const outside = rooms.filter(room => room.xMm < 0 || room.yMm < 0 || room.xMm + room.widthMm > footprint.widthMm || room.yMm + room.depthMm > footprint.depthMm);
  findings.push(outside.length
    ? { code: 'ROOM_OUTSIDE_FOOTPRINT', severity: 'BLOCKER', message: `${outside.length} room(s) exceed the footprint after review.` }
    : { code: 'ROOMS_INSIDE_FOOTPRINT', severity: 'PASS', message: 'All reviewed rooms remain inside the footprint.' });

  let overlapCount = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (roomsOverlap(rooms[i], rooms[j])) overlapCount += 1;
    }
  }
  findings.push(overlapCount
    ? { code: 'ROOM_OVERLAP', severity: 'BLOCKER', message: `${overlapCount} room overlap(s) exist after review.` }
    : { code: 'NO_ROOM_OVERLAP', severity: 'PASS', message: 'No reviewed room overlaps detected.' });

  const wallIds = new Set(walls.map(wall => wall.id));
  findings.push(wallIds.size === walls.length
    ? { code: 'WALL_IDS_UNIQUE', severity: 'PASS', message: 'Wall IDs are unique.' }
    : { code: 'WALL_ID_DUPLICATE', severity: 'BLOCKER', message: 'Duplicate wall IDs detected.' });

  const doorsWithoutHost = doors.filter(door => !findHostWall(door, walls));
  findings.push(doorsWithoutHost.length
    ? { code: 'DOOR_HOST_WALL_MISSING', severity: 'BLOCKER', message: `${doorsWithoutHost.length} door(s) do not resolve to a host wall.` }
    : { code: 'DOOR_HOST_WALL_VALID', severity: 'PASS', message: 'Every proposed door resolves to a host wall.' });

  return findings;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildDrawingIR(program: LayoutProgram, candidateId: LayoutCandidateId, rooms: LayoutRect[], walls: LayoutWallSegment[], doors: LayoutDoorProposal[]) {
  const roomById = new Map(program.rooms.map(room => [room.id, room]));
  const operations: DrawingIROperation[] = [];

  for (const room of rooms) {
    const metadata = roomById.get(room.roomId);
    operations.push({
      op: 'CREATE_ROOM',
      id: room.roomId,
      roomId: room.roomId,
      label: metadata?.label ?? room.roomId,
      kind: metadata?.kind ?? 'GENERIC',
      originMm: [room.xMm, room.yMm, 0],
      widthMm: room.widthMm,
      depthMm: room.depthMm
    });
  }

  for (const wall of walls) {
    operations.push({
      op: 'CREATE_WALL',
      id: wall.id,
      startMm: [wall.x1Mm, wall.y1Mm, 0],
      endMm: [wall.x2Mm, wall.y2Mm, 0],
      thicknessMm: wall.thicknessMm,
      role: wall.role
    });
  }

  for (const door of doors) {
    const host = findHostWall(door, walls);
    operations.push({
      op: 'CREATE_DOOR',
      id: door.id,
      roomId: door.roomId,
      hostWallId: host?.id ?? 'UNRESOLVED',
      widthMm: door.widthMm,
      positionMm: [Math.round(door.xMm), Math.round(door.yMm), 0],
      orientation: door.orientation
    });
  }

  for (const room of rooms) {
    const metadata = roomById.get(room.roomId);
    operations.push({
      op: 'CREATE_LABEL',
      id: `LABEL-${room.roomId}`,
      roomId: room.roomId,
      text: metadata?.label ?? room.roomId,
      positionMm: [Math.round(room.xMm + room.widthMm / 2), Math.round(room.yMm + room.depthMm / 2), 0]
    });
  }

  const deterministicFingerprint = fingerprint({ candidateId, operations });
  return {
    schema: 'archon.sketchup-drawing-ir.v1',
    units: 'mm',
    coordinateSystem: 'SKETCHUP_XY_Z_UP',
    sourceCandidateId: candidateId,
    operations,
    operationCount: operations.length,
    deterministicFingerprint,
    mutation: 'none'
  } satisfies SketchUpDrawingIR;
}

function targetTypeFor(operation: DrawingIROperation): ProposedDrawChangeSet['operations'][number]['targetType'] {
  if (operation.op === 'CREATE_ROOM') return 'ROOM';
  if (operation.op === 'CREATE_WALL') return 'WALL';
  if (operation.op === 'CREATE_DOOR') return 'DOOR';
  return 'LABEL';
}

export function createLayoutReviewProposal(input: {
  prompt: string;
  candidateId: string;
  edits?: LayoutRoomReviewEdit[];
}): LayoutReviewProposal {
  const preview = createPromptLayoutPreview({ prompt: input.prompt });
  if (!preview.program.footprint || !preview.candidates.length) throw new Error('DRAWING_IR_LAYOUT_PREVIEW_NOT_READY');

  const candidate = preview.candidates.find(item => item.id === input.candidateId);
  if (!candidate) throw new Error('DRAWING_IR_CANDIDATE_NOT_FOUND');

  const edits = Array.isArray(input.edits) ? input.edits : [];
  if (edits.length > 100) throw new Error('DRAWING_IR_TOO_MANY_EDITS');

  const rooms = applyRoomEdits(candidate, edits);
  const walls = buildWalls(preview.program, rooms);
  const doors = buildDoors(rooms);
  const validation = validateReviewedGeometry(preview.program, rooms, walls, doors);
  const blocked = validation.some(finding => finding.severity === 'BLOCKER');
  const reviewedCandidate: LayoutCandidate = {
    ...candidate,
    rooms,
    walls,
    doors,
    findings: validation.map(finding => ({ code: finding.code, severity: finding.severity, message: finding.message })),
    valid: !blocked,
    metrics: {
      ...candidate.metrics,
      placedRoomAreaM2: Number((rooms.reduce((sum, room) => sum + room.widthMm * room.depthMm, 0) / 1_000_000).toFixed(2)),
      utilizationRatio: Number(((rooms.reduce((sum, room) => sum + room.widthMm * room.depthMm, 0) / 1_000_000) / preview.program.footprint.areaM2).toFixed(4))
    }
  };

  const drawingIR = buildDrawingIR(preview.program, candidate.id, rooms, walls, doors);
  const proposedChangeSet: ProposedDrawChangeSet = {
    schema: 'archon.sketchup-draw-changeset-proposal.v1',
    id: `DRAW-CS-${drawingIR.deterministicFingerprint}`,
    state: blocked ? 'BLOCKED' : 'PROPOSED',
    intentSummary: `Draw reviewed ${candidate.id} basic 2D layout in SketchUp.`,
    sourceCandidateId: candidate.id,
    operationCount: drawingIR.operationCount,
    operations: drawingIR.operations.map((operation, index) => ({
      operationId: `OP-${String(index + 1).padStart(4, '0')}`,
      action: 'CREATE',
      targetType: targetTypeFor(operation),
      targetId: operation.id,
      payload: operation
    })),
    approvalGranted: false,
    executable: false,
    mutation: 'none'
  };

  return {
    schema: 'archon.layout-review-proposal.v1',
    state: blocked ? 'REVIEW_BLOCKED' : 'REVIEW_READY',
    mutation: 'none',
    sourcePrompt: preview.sourcePrompt,
    program: preview.program,
    selectedCandidateId: candidate.id,
    editsApplied: edits,
    reviewedCandidate,
    validation,
    drawingIR,
    proposedChangeSet,
    checklist: [
      { stage: 'Intent', status: 'PASS', evidence: 'Original prompt is bound to this review proposal.' },
      { stage: 'Candidate Selection', status: 'PASS', evidence: `${candidate.id} selected explicitly.` },
      { stage: 'Review/Edit', status: blocked ? 'BLOCKED' : 'PASS', evidence: `${edits.length} room edit(s) applied and geometry revalidated.` },
      { stage: 'Drawing IR', status: blocked ? 'BLOCKED' : 'PASS', evidence: `${drawingIR.operationCount} deterministic native-drawing operations proposed.` },
      { stage: 'Proposed ChangeSet', status: blocked ? 'BLOCKED' : 'PASS', evidence: `${proposedChangeSet.id} remains non-executable.` },
      { stage: 'Approval', status: 'LOCKED', evidence: 'Explicit Approve & Draw gate is not enabled in v0.3.1.' },
      { stage: 'SketchUp Mutation', status: 'LOCKED', evidence: 'No Ruby geometry executor is called by this proposal path.' }
    ],
    governance: {
      approvalGranted: false,
      sketchUpGeometryMutated: false,
      immutableVersionCreated: false,
      executionEnabled: false
    }
  };
}
