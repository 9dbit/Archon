export const BUILDING_GRAPH_SCHEMA = 'archon.building-graph.v2' as const;

export type BuildingGraphNodeKind =
  | 'WALL'
  | 'DOOR'
  | 'WINDOW'
  | 'ROOM'
  | 'FLOOR'
  | 'CEILING'
  | 'FURNITURE'
  | 'JOINERY'
  | 'UNKNOWN';

export type BuildingGraphClassificationSource =
  | 'EXPLICIT_METADATA'
  | 'LEXICAL'
  | 'GEOMETRY_HINT'
  | 'UNKNOWN';

export interface BuildingGraphBoundsMm {
  min?: { x?: number; y?: number; z?: number };
  max?: { x?: number; y?: number; z?: number };
  size?: { x?: number; y?: number; z?: number };
}

export interface SketchUpSemanticEntityRecord {
  persistent_id?: number | string | null;
  parent_persistent_id?: number | string | null;
  depth?: number | null;
  path?: Array<number | string> | null;
  type?: string | null;
  name?: string | null;
  tag?: string | null;
  definition?: string | null;
  bounds_mm?: BuildingGraphBoundsMm | null;
  archon?: Record<string, unknown> | null;
}

export interface SketchUpManifestLike {
  schema?: string;
  project_id?: string | null;
  semantic_hash?: string | null;
  model?: {
    guid?: string | null;
    title?: string | null;
    filename?: string | null;
  } | null;
  semantic_inventory?: SketchUpSemanticEntityRecord[] | null;
  root_entities?: SketchUpSemanticEntityRecord[] | null;
}

export interface BuildingGraphClassification {
  kind: BuildingGraphNodeKind;
  source: BuildingGraphClassificationSource;
  confidence: number;
  reviewRequired: boolean;
  evidence: string[];
}

export interface BuildingGraphNode {
  id: string;
  sourcePersistentId: string | null;
  parentSourcePersistentId: string | null;
  sourceDepth: number;
  sourcePath: string[];
  kind: BuildingGraphNodeKind;
  name: string | null;
  tag: string | null;
  definition: string | null;
  boundsMm: BuildingGraphBoundsMm | null;
  confidence: number;
  classificationSource: BuildingGraphClassificationSource;
  reviewRequired: boolean;
  evidence: string[];
}

export interface BuildingGraphV2Preview {
  schema: typeof BUILDING_GRAPH_SCHEMA;
  source: 'SKETCHUP';
  projectId: string | null;
  modelGuid: string;
  semanticHash: string | null;
  generatedFrom: 'semantic_inventory' | 'root_entities';
  nodes: BuildingGraphNode[];
  summary: {
    nodeCount: number;
    classifiedCount: number;
    unresolvedCount: number;
    reviewRequiredCount: number;
    byKind: Record<BuildingGraphNodeKind, number>;
  };
  mutation: 'none';
}

const KIND_PATTERNS: Array<{
  kind: Exclude<BuildingGraphNodeKind, 'UNKNOWN'>;
  patterns: RegExp[];
}> = [
  {
    kind: 'DOOR',
    patterns: [/(^|[^a-z])(door|pintu|dr)([^a-z]|$)/i]
  },
  {
    kind: 'WINDOW',
    patterns: [/(^|[^a-z])(window|jendela|wnd|win)([^a-z]|$)/i]
  },
  {
    kind: 'ROOM',
    patterns: [/(^|[^a-z])(room|ruang|space|area)([^a-z]|$)/i]
  },
  {
    kind: 'CEILING',
    patterns: [/(^|[^a-z])(ceiling|plafon|plafond|rcp)([^a-z]|$)/i]
  },
  {
    kind: 'FLOOR',
    patterns: [/(^|[^a-z])(floor|lantai|slab)([^a-z]|$)/i]
  },
  {
    kind: 'JOINERY',
    patterns: [
      /(^|[^a-z])(joinery|cabinet|cabinetry|millwork|built[ -]?in|counter|bar|banquette|reception)([^a-z]|$)/i,
      /(^|[^a-z])(lemari|kabinet|meja built[ -]?in)([^a-z]|$)/i
    ]
  },
  {
    kind: 'FURNITURE',
    patterns: [
      /(^|[^a-z])(furniture|chair|table|sofa|stool|bench|loose furniture)([^a-z]|$)/i,
      /(^|[^a-z])(kursi|meja|sofa|bangku)([^a-z]|$)/i
    ]
  },
  {
    kind: 'WALL',
    patterns: [/(^|[^a-z])(wall|dinding|partition|partisi)([^a-z]|$)/i]
  }
];

const EXPLICIT_KEYS = ['type', 'category', 'class', 'kind', 'semantic_type'];

function normalizeKind(value: unknown): BuildingGraphNodeKind | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[ -]+/g, '_');
  const aliases: Record<string, BuildingGraphNodeKind> = {
    WALL: 'WALL',
    DINDING: 'WALL',
    PARTITION: 'WALL',
    DOOR: 'DOOR',
    PINTU: 'DOOR',
    WINDOW: 'WINDOW',
    JENDELA: 'WINDOW',
    ROOM: 'ROOM',
    RUANG: 'ROOM',
    SPACE: 'ROOM',
    FLOOR: 'FLOOR',
    LANTAI: 'FLOOR',
    CEILING: 'CEILING',
    PLAFON: 'CEILING',
    PLAFOND: 'CEILING',
    FURNITURE: 'FURNITURE',
    LOOSE_FURNITURE: 'FURNITURE',
    JOINERY: 'JOINERY',
    CABINETRY: 'JOINERY',
    MILLWORK: 'JOINERY'
  };
  return aliases[normalized] ?? null;
}

function explicitClassification(
  entity: SketchUpSemanticEntityRecord
): BuildingGraphClassification | null {
  const archon = entity.archon ?? {};
  for (const key of EXPLICIT_KEYS) {
    const kind = normalizeKind(archon[key]);
    if (kind) {
      return {
        kind,
        source: 'EXPLICIT_METADATA',
        confidence: 1,
        reviewRequired: false,
        evidence: [`ARCHON.${key}=${String(archon[key])}`]
      };
    }
  }
  return null;
}

function lexicalClassification(
  entity: SketchUpSemanticEntityRecord
): BuildingGraphClassification | null {
  const signals = [
    ['name', entity.name],
    ['tag', entity.tag],
    ['definition', entity.definition]
  ] as const;

  for (const rule of KIND_PATTERNS) {
    for (const [label, value] of signals) {
      if (!value) continue;
      if (rule.patterns.some((pattern) => pattern.test(value))) {
        return {
          kind: rule.kind,
          source: 'LEXICAL',
          confidence: label === 'tag' ? 0.9 : 0.84,
          reviewRequired: false,
          evidence: [`${label}=${value}`]
        };
      }
    }
  }
  return null;
}

function geometryHintClassification(
  entity: SketchUpSemanticEntityRecord
): BuildingGraphClassification | null {
  const size = entity.bounds_mm?.size;
  const x = typeof size?.x === 'number' ? Math.abs(size.x) : null;
  const y = typeof size?.y === 'number' ? Math.abs(size.y) : null;
  const z = typeof size?.z === 'number' ? Math.abs(size.z) : null;
  if (x === null || y === null || z === null) return null;

  const horizontalMax = Math.max(x, y);
  const horizontalMin = Math.min(x, y);
  const entityType = entity.type?.toLowerCase() ?? '';
  const containerLike = entityType.includes('group') || entityType.includes('component');
  if (!containerLike) return null;

  if (
    z >= 1_800 &&
    z <= 6_000 &&
    horizontalMax >= 1_500 &&
    horizontalMin > 0 &&
    horizontalMin <= 500 &&
    horizontalMax / horizontalMin >= 4
  ) {
    return {
      kind: 'WALL',
      source: 'GEOMETRY_HINT',
      confidence: 0.58,
      reviewRequired: true,
      evidence: [
        `wall-like bounds ${x.toFixed(1)}×${y.toFixed(1)}×${z.toFixed(1)} mm`
      ]
    };
  }

  if (
    z >= 1_800 &&
    z <= 3_000 &&
    horizontalMax >= 600 &&
    horizontalMax <= 2_000 &&
    horizontalMin <= 450
  ) {
    return {
      kind: 'DOOR',
      source: 'GEOMETRY_HINT',
      confidence: 0.45,
      reviewRequired: true,
      evidence: [
        `door-like bounds ${x.toFixed(1)}×${y.toFixed(1)}×${z.toFixed(1)} mm`
      ]
    };
  }

  return null;
}

export function classifySketchUpEntity(
  entity: SketchUpSemanticEntityRecord
): BuildingGraphClassification {
  return (
    explicitClassification(entity) ??
    lexicalClassification(entity) ??
    geometryHintClassification(entity) ?? {
      kind: 'UNKNOWN',
      source: 'UNKNOWN',
      confidence: 0,
      reviewRequired: true,
      evidence: ['No deterministic semantic signal found']
    }
  );
}

function toSourceId(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function nodeId(modelGuid: string, sourceId: string | null, index: number) {
  return `sketchup:${modelGuid}:${sourceId ?? `index-${index}`}`;
}

function emptyKindCounts(): Record<BuildingGraphNodeKind, number> {
  return {
    WALL: 0,
    DOOR: 0,
    WINDOW: 0,
    ROOM: 0,
    FLOOR: 0,
    CEILING: 0,
    FURNITURE: 0,
    JOINERY: 0,
    UNKNOWN: 0
  };
}

export function buildBuildingGraphV2Preview(
  manifest: SketchUpManifestLike
): BuildingGraphV2Preview {
  const modelGuid = manifest.model?.guid?.trim();
  if (!modelGuid) throw new Error('BUILDING_GRAPH_REQUIRES_MODEL_GUID');

  const semanticInventory = Array.isArray(manifest.semantic_inventory)
    ? manifest.semantic_inventory
    : [];
  const rootEntities = Array.isArray(manifest.root_entities)
    ? manifest.root_entities
    : [];
  const records = semanticInventory.length > 0 ? semanticInventory : rootEntities;
  const generatedFrom =
    semanticInventory.length > 0 ? 'semantic_inventory' : 'root_entities';

  const nodes = records.map((entity, index) => {
    const classification = classifySketchUpEntity(entity);
    const sourcePersistentId = toSourceId(entity.persistent_id);
    const parentSourcePersistentId = toSourceId(entity.parent_persistent_id);
    const sourcePath = Array.isArray(entity.path)
      ? entity.path.map((part) => String(part))
      : sourcePersistentId
        ? [sourcePersistentId]
        : [];

    return {
      id: nodeId(modelGuid, sourcePersistentId, index),
      sourcePersistentId,
      parentSourcePersistentId,
      sourceDepth:
        typeof entity.depth === 'number' && Number.isFinite(entity.depth)
          ? entity.depth
          : 0,
      sourcePath,
      kind: classification.kind,
      name: entity.name ?? null,
      tag: entity.tag ?? null,
      definition: entity.definition ?? null,
      boundsMm: entity.bounds_mm ?? null,
      confidence: classification.confidence,
      classificationSource: classification.source,
      reviewRequired: classification.reviewRequired,
      evidence: classification.evidence
    } satisfies BuildingGraphNode;
  });

  const byKind = emptyKindCounts();
  for (const node of nodes) byKind[node.kind] += 1;

  const unresolvedCount = byKind.UNKNOWN;
  const reviewRequiredCount = nodes.filter((node) => node.reviewRequired).length;

  return {
    schema: BUILDING_GRAPH_SCHEMA,
    source: 'SKETCHUP',
    projectId:
      typeof manifest.project_id === 'string' && manifest.project_id.length > 0
        ? manifest.project_id
        : null,
    modelGuid,
    semanticHash:
      typeof manifest.semantic_hash === 'string' ? manifest.semantic_hash : null,
    generatedFrom,
    nodes,
    summary: {
      nodeCount: nodes.length,
      classifiedCount: nodes.length - unresolvedCount,
      unresolvedCount,
      reviewRequiredCount,
      byKind
    },
    mutation: 'none'
  };
}
