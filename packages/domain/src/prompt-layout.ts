export type LayoutRoomKind =
  | 'RECEPTION'
  | 'MEETING'
  | 'DIRECTOR'
  | 'OPEN_OFFICE'
  | 'PRIVATE_OFFICE'
  | 'PANTRY'
  | 'TOILET_M'
  | 'TOILET_F'
  | 'STORAGE'
  | 'KITCHEN'
  | 'DINING'
  | 'PRIVATE_DINING'
  | 'BAR'
  | 'GENERIC';

export type LayoutProgramRoom = {
  id: string;
  kind: LayoutRoomKind;
  label: string;
  quantityIndex: number;
  targetWidthMm: number;
  targetDepthMm: number;
  targetAreaM2: number;
  capacity?: number | null;
  source: 'EXPLICIT_PROMPT' | 'PROMPT_KEYWORD_DEFAULT';
};

export type LayoutProgram = {
  schema: 'archon.layout-program.v1';
  sourcePrompt: string;
  footprint: { widthMm: number; depthMm: number; areaM2: number } | null;
  wallThicknessMm: number;
  corridorMinMm: number;
  rooms: LayoutProgramRoom[];
  assumptions: string[];
  unresolved: string[];
};

export type LayoutRect = {
  roomId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
};

export type LayoutWallSegment = {
  id: string;
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
  thicknessMm: number;
  role: 'PERIMETER' | 'PARTITION';
};

export type LayoutDoorProposal = {
  id: string;
  roomId: string;
  widthMm: number;
  xMm: number;
  yMm: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
};

export type LayoutFinding = {
  code: string;
  severity: 'PASS' | 'WARNING' | 'BLOCKER';
  message: string;
};

export type LayoutCandidate = {
  id: 'OPTION_A' | 'OPTION_B' | 'OPTION_C';
  strategy: 'HORIZONTAL_SHELVES' | 'VERTICAL_SHELVES' | 'PUBLIC_FRONT_SUPPORT_REAR';
  rooms: LayoutRect[];
  walls: LayoutWallSegment[];
  doors: LayoutDoorProposal[];
  metrics: {
    footprintAreaM2: number;
    programmedRoomAreaM2: number;
    placedRoomAreaM2: number;
    utilizationRatio: number;
  };
  findings: LayoutFinding[];
  valid: boolean;
};

export type PromptLayoutPreview = {
  schema: 'archon.prompt-layout-preview.v1';
  state: 'LAYOUT_PREVIEW_READY' | 'LAYOUT_REQUIRES_INPUT' | 'LAYOUT_CONSTRAINT_BLOCKED';
  mutation: 'none';
  sourcePrompt: string;
  program: LayoutProgram;
  candidates: LayoutCandidate[];
  checklist: Array<{
    stage: string;
    status: 'PASS' | 'PENDING' | 'LOCKED' | 'BLOCKED';
    evidence: string;
  }>;
  governance: {
    approvedGraphMutated: false;
    approvalGranted: false;
    sketchUpGeometryMutated: false;
    immutableVersionCreated: false;
  };
};

const MAX_PROMPT = 2000;
const DEFAULT_WALL_MM = 100;
const DEFAULT_CORRIDOR_MM = 1200;
const MIN_FOOTPRINT_MM = 3000;
const MAX_FOOTPRINT_MM = 100000;

const ROOM_DEFS: Array<{
  kind: LayoutRoomKind;
  labels: string[];
  display: string;
  defaultSize: [number, number];
  defaultCapacity?: number;
}> = [
  { kind: 'RECEPTION', labels: ['reception', 'resepsionis', 'lobby'], display: 'Reception', defaultSize: [4000, 4500] },
  { kind: 'MEETING', labels: ['meeting room', 'ruang meeting', 'meeting'], display: 'Meeting Room', defaultSize: [4000, 4500] },
  { kind: 'DIRECTOR', labels: ['director room', 'ruang direktur', 'director', 'direktur'], display: 'Director Room', defaultSize: [4000, 4500] },
  { kind: 'OPEN_OFFICE', labels: ['open office', 'open workspace', 'staff area', 'area staff'], display: 'Open Office', defaultSize: [7000, 8000], defaultCapacity: 20 },
  { kind: 'PRIVATE_OFFICE', labels: ['private office', 'ruang private', 'office private'], display: 'Private Office', defaultSize: [3000, 3500] },
  { kind: 'PANTRY', labels: ['pantry'], display: 'Pantry', defaultSize: [3000, 3500] },
  { kind: 'TOILET_M', labels: ['toilet pria', 'male toilet', 'mens toilet', 'toilet male'], display: 'Male Toilet', defaultSize: [2500, 3000] },
  { kind: 'TOILET_F', labels: ['toilet wanita', 'female toilet', 'womens toilet', 'toilet female'], display: 'Female Toilet', defaultSize: [2500, 3000] },
  { kind: 'STORAGE', labels: ['storage', 'gudang'], display: 'Storage', defaultSize: [2500, 2500] },
  { kind: 'KITCHEN', labels: ['kitchen', 'dapur'], display: 'Kitchen', defaultSize: [5000, 6000] },
  { kind: 'DINING', labels: ['main dining', 'dining', 'ruang makan'], display: 'Dining', defaultSize: [8000, 9000] },
  { kind: 'PRIVATE_DINING', labels: ['private dining', 'vip dining', 'private room'], display: 'Private Dining', defaultSize: [4500, 5000] },
  { kind: 'BAR', labels: ['bar counter', 'bar area', 'bar'], display: 'Bar', defaultSize: [3500, 6000] }
];

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function toMm(value: string, unit: string) {
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  const u = unit.toLowerCase();
  if (u === 'm' || u.startsWith('meter')) return Math.round(number * 1000);
  if (u === 'cm') return Math.round(number * 10);
  return Math.round(number);
}

function parseFootprint(prompt: string) {
  const match = prompt.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|meter|meters|metre|metres)\b/i);
  if (!match) return null;
  const widthMm = toMm(match[1], match[3]);
  const depthMm = toMm(match[2], match[3]);
  if (!widthMm || !depthMm) return null;
  return { widthMm, depthMm, areaM2: Number(((widthMm * depthMm) / 1_000_000).toFixed(2)) };
}

function parseSingleMeasurement(prompt: string, terms: string[], fallback: number) {
  const p = prompt.toLowerCase();
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = p.match(new RegExp(`${escaped}[^\\d]{0,24}(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m|meter|meters)\\b`, 'i'));
    if (match) {
      const mm = toMm(match[1], match[2]);
      if (mm) return mm;
    }
  }
  return fallback;
}

function quantityFor(prompt: string, labels: string[]) {
  const p = prompt.toLowerCase();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = p.match(new RegExp(`(\\d+)\\s*(?:x\\s*)?${escaped}`, 'i'));
    if (before) return Math.max(1, Math.min(12, Number(before[1])));
    const after = p.match(new RegExp(`${escaped}\\s*(?:sebanyak|x)?\\s*(\\d+)`, 'i'));
    if (after) return Math.max(1, Math.min(12, Number(after[1])));
  }
  return labels.some(label => p.includes(label)) ? 1 : 0;
}

function explicitRoomSize(prompt: string, labels: string[]) {
  const p = prompt.toLowerCase();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = p.match(new RegExp(`${escaped}[^\\d]{0,28}(\\d+(?:[.,]\\d+)?)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m|meter|meters)`, 'i'));
    if (!match) continue;
    const widthMm = toMm(match[1], match[3]);
    const depthMm = toMm(match[2], match[3]);
    if (widthMm && depthMm) return [widthMm, depthMm] as [number, number];
  }
  return null;
}

function parseCapacity(prompt: string) {
  const match = prompt.match(/(\d+)\s*(staff|orang|people|pax|seat|seats)\b/i);
  return match ? Math.max(1, Math.min(500, Number(match[1]))) : null;
}

export function parseLayoutPrompt(rawPrompt: string): LayoutProgram {
  const prompt = clean(rawPrompt ?? '');
  if (!prompt || prompt.length > MAX_PROMPT) throw new Error('PROMPT_LAYOUT_PROMPT_INVALID');

  const footprint = parseFootprint(prompt);
  const wallThicknessMm = parseSingleMeasurement(prompt, ['wall thickness', 'tebal dinding', 'dinding'], DEFAULT_WALL_MM);
  const corridorMinMm = parseSingleMeasurement(prompt, ['minimum corridor', 'corridor minimum', 'koridor minimum', 'lebar koridor'], DEFAULT_CORRIDOR_MM);
  const capacity = parseCapacity(prompt);
  const rooms: LayoutProgramRoom[] = [];
  const assumptions: string[] = [];
  const unresolved: string[] = [];

  for (const def of ROOM_DEFS) {
    const quantity = quantityFor(prompt, def.labels);
    if (!quantity) continue;
    const explicitSize = explicitRoomSize(prompt, def.labels);
    const [widthMm, depthMm] = explicitSize ?? def.defaultSize;
    if (!explicitSize) assumptions.push(`${def.display} uses default ${widthMm}x${depthMm} mm pending review.`);
    for (let index = 1; index <= quantity; index += 1) {
      const roomCapacity = def.kind === 'OPEN_OFFICE' ? capacity ?? def.defaultCapacity ?? null : null;
      rooms.push({
        id: `ROOM-${String(rooms.length + 1).padStart(3, '0')}`,
        kind: def.kind,
        label: quantity > 1 ? `${def.display} ${index}` : def.display,
        quantityIndex: index,
        targetWidthMm: widthMm,
        targetDepthMm: depthMm,
        targetAreaM2: Number(((widthMm * depthMm) / 1_000_000).toFixed(2)),
        capacity: roomCapacity,
        source: explicitSize ? 'EXPLICIT_PROMPT' : 'PROMPT_KEYWORD_DEFAULT'
      });
    }
  }

  if (!footprint) unresolved.push('Building footprint is required, e.g. 12 x 20 m.');
  if (!rooms.length) unresolved.push('At least one recognizable room/program requirement is required.');
  if (wallThicknessMm < 50 || wallThicknessMm > 500) unresolved.push('Wall thickness must be between 50 and 500 mm for this MVP.');
  if (corridorMinMm < 900 || corridorMinMm > 3000) unresolved.push('Minimum corridor must be between 900 and 3000 mm for this MVP.');

  return {
    schema: 'archon.layout-program.v1',
    sourcePrompt: prompt,
    footprint,
    wallThicknessMm,
    corridorMinMm,
    rooms,
    assumptions,
    unresolved
  };
}

function roomOrdering(rooms: LayoutProgramRoom[], strategy: LayoutCandidate['strategy']) {
  const publicKinds = new Set<LayoutRoomKind>(['RECEPTION', 'MEETING', 'DINING', 'BAR']);
  const supportKinds = new Set<LayoutRoomKind>(['PANTRY', 'TOILET_M', 'TOILET_F', 'STORAGE', 'KITCHEN']);
  if (strategy === 'PUBLIC_FRONT_SUPPORT_REAR') {
    return [...rooms].sort((a, b) => {
      const score = (room: LayoutProgramRoom) => publicKinds.has(room.kind) ? 0 : supportKinds.has(room.kind) ? 2 : 1;
      return score(a) - score(b) || a.id.localeCompare(b.id);
    });
  }
  if (strategy === 'VERTICAL_SHELVES') return [...rooms].sort((a, b) => b.targetDepthMm - a.targetDepthMm || a.id.localeCompare(b.id));
  return [...rooms].sort((a, b) => b.targetWidthMm - a.targetWidthMm || a.id.localeCompare(b.id));
}

function packHorizontal(program: LayoutProgram, strategy: LayoutCandidate['strategy']) {
  const footprint = program.footprint!;
  const margin = program.wallThicknessMm;
  const maxX = footprint.widthMm - margin;
  const maxY = footprint.depthMm - margin;
  let x = margin;
  let y = margin;
  let shelfDepth = 0;
  const rects: LayoutRect[] = [];
  for (const room of roomOrdering(program.rooms, strategy)) {
    let width = room.targetWidthMm;
    let depth = room.targetDepthMm;
    if (strategy === 'VERTICAL_SHELVES') [width, depth] = [depth, width];
    if (x + width > maxX) {
      x = margin;
      y += shelfDepth + program.corridorMinMm;
      shelfDepth = 0;
    }
    rects.push({ roomId: room.id, xMm: x, yMm: y, widthMm: width, depthMm: depth });
    x += width + program.wallThicknessMm;
    shelfDepth = Math.max(shelfDepth, depth);
  }
  return rects;
}

function packVertical(program: LayoutProgram) {
  const swapped: LayoutProgram = {
    ...program,
    footprint: program.footprint ? {
      widthMm: program.footprint.depthMm,
      depthMm: program.footprint.widthMm,
      areaM2: program.footprint.areaM2
    } : null
  };
  return packHorizontal(swapped, 'VERTICAL_SHELVES').map(rect => ({
    roomId: rect.roomId,
    xMm: rect.yMm,
    yMm: rect.xMm,
    widthMm: rect.depthMm,
    depthMm: rect.widthMm
  }));
}

function dedupeWalls(rects: LayoutRect[], program: LayoutProgram) {
  const walls = new Map<string, LayoutWallSegment>();
  const add = (x1: number, y1: number, x2: number, y2: number, role: LayoutWallSegment['role']) => {
    const a = `${x1},${y1}`;
    const b = `${x2},${y2}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!walls.has(key)) {
      walls.set(key, {
        id: `WALL-${String(walls.size + 1).padStart(3, '0')}`,
        x1Mm: x1,
        y1Mm: y1,
        x2Mm: x2,
        y2Mm: y2,
        thicknessMm: program.wallThicknessMm,
        role
      });
    }
  };
  const f = program.footprint!;
  add(0, 0, f.widthMm, 0, 'PERIMETER');
  add(f.widthMm, 0, f.widthMm, f.depthMm, 'PERIMETER');
  add(f.widthMm, f.depthMm, 0, f.depthMm, 'PERIMETER');
  add(0, f.depthMm, 0, 0, 'PERIMETER');
  for (const rect of rects) {
    const x2 = rect.xMm + rect.widthMm;
    const y2 = rect.yMm + rect.depthMm;
    add(rect.xMm, rect.yMm, x2, rect.yMm, 'PARTITION');
    add(x2, rect.yMm, x2, y2, 'PARTITION');
    add(x2, y2, rect.xMm, y2, 'PARTITION');
    add(rect.xMm, y2, rect.xMm, rect.yMm, 'PARTITION');
  }
  return [...walls.values()];
}

function proposeDoors(rects: LayoutRect[]) {
  return rects.map((rect, index): LayoutDoorProposal => ({
    id: `DOOR-${String(index + 1).padStart(3, '0')}`,
    roomId: rect.roomId,
    widthMm: 900,
    xMm: rect.xMm + Math.min(1200, Math.max(450, rect.widthMm / 2)),
    yMm: rect.yMm,
    orientation: 'HORIZONTAL'
  }));
}

function overlaps(a: LayoutRect, b: LayoutRect) {
  return a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm && a.yMm < b.yMm + b.depthMm && a.yMm + a.depthMm > b.yMm;
}

function validateCandidate(program: LayoutProgram, rects: LayoutRect[]) {
  const findings: LayoutFinding[] = [];
  const footprint = program.footprint!;
  const outside = rects.filter(rect => rect.xMm < 0 || rect.yMm < 0 || rect.xMm + rect.widthMm > footprint.widthMm || rect.yMm + rect.depthMm > footprint.depthMm);
  findings.push(outside.length
    ? { code: 'ROOM_OUTSIDE_FOOTPRINT', severity: 'BLOCKER', message: `${outside.length} room(s) exceed the building footprint.` }
    : { code: 'ROOMS_INSIDE_FOOTPRINT', severity: 'PASS', message: 'All proposed rooms stay inside the building footprint.' });

  let overlapCount = 0;
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) if (overlaps(rects[i], rects[j])) overlapCount += 1;
  }
  findings.push(overlapCount
    ? { code: 'ROOM_OVERLAP', severity: 'BLOCKER', message: `${overlapCount} room overlap(s) detected.` }
    : { code: 'NO_ROOM_OVERLAP', severity: 'PASS', message: 'No room rectangle overlaps were detected.' });

  const programmedArea = program.rooms.reduce((sum, room) => sum + room.targetAreaM2, 0);
  const ratio = programmedArea / footprint.areaM2;
  findings.push(ratio > 0.82
    ? { code: 'PROGRAM_DENSITY_HIGH', severity: 'WARNING', message: `Program occupies ${(ratio * 100).toFixed(1)}% of footprint before circulation/wall allowances.` }
    : { code: 'PROGRAM_DENSITY_OK', severity: 'PASS', message: `Program density ${(ratio * 100).toFixed(1)}% leaves allowance for circulation and walls.` });

  return findings;
}

function makeCandidate(id: LayoutCandidate['id'], strategy: LayoutCandidate['strategy'], program: LayoutProgram): LayoutCandidate {
  const rects = strategy === 'VERTICAL_SHELVES' ? packVertical(program) : packHorizontal(program, strategy);
  const findings = validateCandidate(program, rects);
  const programmedRoomAreaM2 = Number(program.rooms.reduce((sum, room) => sum + room.targetAreaM2, 0).toFixed(2));
  const placedRoomAreaM2 = Number((rects.reduce((sum, rect) => sum + rect.widthMm * rect.depthMm, 0) / 1_000_000).toFixed(2));
  const footprintAreaM2 = program.footprint!.areaM2;
  return {
    id,
    strategy,
    rooms: rects,
    walls: dedupeWalls(rects, program),
    doors: proposeDoors(rects),
    metrics: {
      footprintAreaM2,
      programmedRoomAreaM2,
      placedRoomAreaM2,
      utilizationRatio: Number((placedRoomAreaM2 / footprintAreaM2).toFixed(4))
    },
    findings,
    valid: !findings.some(finding => finding.severity === 'BLOCKER')
  };
}

export function createPromptLayoutPreview(input: { prompt: string }): PromptLayoutPreview {
  const program = parseLayoutPrompt(input.prompt);
  if (program.unresolved.length || !program.footprint) {
    return {
      schema: 'archon.prompt-layout-preview.v1',
      state: 'LAYOUT_REQUIRES_INPUT',
      mutation: 'none',
      sourcePrompt: program.sourcePrompt,
      program,
      candidates: [],
      checklist: [
        { stage: 'Intent', status: 'PASS', evidence: 'Prompt captured as layout intent.' },
        { stage: 'Space Program', status: 'BLOCKED', evidence: program.unresolved.join(' ') || 'Required layout input is missing.' },
        { stage: 'Layout Solver', status: 'LOCKED', evidence: 'Solver waits for complete footprint and program input.' },
        { stage: 'Approval', status: 'LOCKED', evidence: 'No geometry mutation can occur from this preview.' }
      ],
      governance: { approvedGraphMutated: false, approvalGranted: false, sketchUpGeometryMutated: false, immutableVersionCreated: false }
    };
  }

  if (program.footprint.widthMm < MIN_FOOTPRINT_MM || program.footprint.depthMm < MIN_FOOTPRINT_MM || program.footprint.widthMm > MAX_FOOTPRINT_MM || program.footprint.depthMm > MAX_FOOTPRINT_MM) {
    program.unresolved.push('Footprint dimensions must be between 3 m and 100 m per side for this MVP.');
    return createPromptLayoutPreview({ prompt: program.sourcePrompt.replace(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*(mm|cm|m|meter|meters)/i, '') });
  }

  const candidates = [
    makeCandidate('OPTION_A', 'HORIZONTAL_SHELVES', program),
    makeCandidate('OPTION_B', 'VERTICAL_SHELVES', program),
    makeCandidate('OPTION_C', 'PUBLIC_FRONT_SUPPORT_REAR', program)
  ];
  const validCount = candidates.filter(candidate => candidate.valid).length;
  const state: PromptLayoutPreview['state'] = validCount > 0 ? 'LAYOUT_PREVIEW_READY' : 'LAYOUT_CONSTRAINT_BLOCKED';

  return {
    schema: 'archon.prompt-layout-preview.v1',
    state,
    mutation: 'none',
    sourcePrompt: program.sourcePrompt,
    program,
    candidates,
    checklist: [
      { stage: 'Intent', status: 'PASS', evidence: 'Prompt normalized into a layout-generation intent.' },
      { stage: 'Space Program', status: 'PASS', evidence: `${program.rooms.length} room/program item(s) parsed.` },
      { stage: 'Constraints', status: state === 'LAYOUT_PREVIEW_READY' ? 'PASS' : 'BLOCKED', evidence: `${validCount} of ${candidates.length} layout candidates pass MVP geometry constraints.` },
      { stage: 'Sandbox/Preview', status: 'PASS', evidence: 'All candidates are JSON previews only; SketchUp geometry remains untouched.' },
      { stage: 'Review/Edit', status: 'PENDING', evidence: 'Operator must choose and review one candidate.' },
      { stage: 'Approval', status: 'LOCKED', evidence: 'Approve & Draw is not implemented in this slice.' },
      { stage: 'SketchUp Mutation', status: 'LOCKED', evidence: 'Native SketchUp drawing generation remains disabled.' }
    ],
    governance: { approvedGraphMutated: false, approvalGranted: false, sketchUpGeometryMutated: false, immutableVersionCreated: false }
  };
}
