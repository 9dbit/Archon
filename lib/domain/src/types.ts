import { z } from "zod";

/** Canonical unit policy (docs/02): all lengths in integer millimetres. */
export const LENGTH_UNIT = "mm" as const;

// ---------------------------------------------------------------------------
// Design locks (docs/05 §8)
// ---------------------------------------------------------------------------
export const DESIGN_LOCK_DOMAINS = [
  "geometry",
  "structure",
  "layout",
  "openings",
  "furniture",
  "materials",
  "lighting",
  "camera",
  "documentation",
  "rules",
] as const;
export type DesignLockDomain = (typeof DESIGN_LOCK_DOMAINS)[number];
export const designLockDomainSchema = z.enum(DESIGN_LOCK_DOMAINS);

// ---------------------------------------------------------------------------
// ChangeSet lifecycle (docs/02, docs/05 §4)
// ---------------------------------------------------------------------------
export const CHANGE_SET_STATES = [
  "DRAFT",
  "PROPOSED",
  "SANDBOXED",
  "VALIDATING",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "COMMITTING",
  "COMMITTED",
  "VALIDATION_FAILED",
] as const;
export type ChangeSetState = (typeof CHANGE_SET_STATES)[number];

export const VALIDATION_STATUSES = [
  "PASS",
  "WARNING",
  "BLOCKER",
  "CRITICAL",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------
export const SOURCE_TYPES = [
  "USER_INPUT",
  "AI_PROPOSAL",
  "DETERMINISTIC_RULE",
  "REGULATION",
  "STANDARD",
  "ADAPTER",
  "SEED",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const sourceTypeSchema = z.enum(SOURCE_TYPES);

export const provenanceSchema = z.object({
  sourceType: sourceTypeSchema,
  sourceReference: z.string().min(1).optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------
export const dimensionMmSchema = z.number().int().positive();

export const programRequirementSchema = z.object({
  name: z.string().min(1),
  areaSqm: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const briefInputSchema = z.object({
  siteWidthMm: dimensionMmSchema.optional(),
  siteDepthMm: dimensionMmSchema.optional(),
  siteAreaSqm: z.number().positive().optional(),
  levels: z.number().int().positive().optional(),
  floorToFloorHeightsMm: z.array(z.number().int()).optional(),
  targetGfaSqm: z.number().positive().optional(),
  programRequirements: z.array(programRequirementSchema).optional(),
  setbacks: z
    .object({
      frontMm: z.number().int().nonnegative().optional(),
      rearMm: z.number().int().nonnegative().optional(),
      sideMm: z.number().int().nonnegative().optional(),
    })
    .optional(),
  circulation: z
    .object({ minCorridorWidthMm: z.number().int().optional() })
    .optional(),
  doorStandards: z
    .object({
      widthMm: z.number().int().optional(),
      heightMm: z.number().int().optional(),
    })
    .optional(),
  windowStandards: z
    .object({
      sillMm: z.number().int().optional(),
      headMm: z.number().int().optional(),
    })
    .optional(),
  /** Canonical unit declaration. Must be 'mm' — validation enforces it. */
  lengthUnit: z.string().default(LENGTH_UNIT),
  notes: z.string().optional(),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
export const RULE_OPERATORS = [">=", "<=", "==", ">", "<"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const RULE_SEVERITIES = [
  "INFO",
  "WARNING",
  "BLOCKER",
  "CRITICAL",
] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

/** Subjects the deterministic rule engine knows how to observe. */
export const RULE_SUBJECTS = [
  "corridorWidthMm",
  "doorWidthMm",
  "doorHeightMm",
  "floorToFloorMm",
  "windowSillMm",
  "windowHeadMm",
  "levels",
  "siteWidthMm",
  "siteDepthMm",
] as const;
export type RuleSubject = (typeof RULE_SUBJECTS)[number];

export const ruleInputSchema = z.object({
  code: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  subject: z.enum(RULE_SUBJECTS),
  operator: z.enum(RULE_OPERATORS),
  expectedValue: z.number(),
  unit: z.string().min(1),
  sourceType: sourceTypeSchema,
  sourceReference: z.string().optional(),
  severity: z.enum(RULE_SEVERITIES),
  active: z.boolean().default(true),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;

// ---------------------------------------------------------------------------
// Canonical objects
// ---------------------------------------------------------------------------
export const canonicalObjectInputSchema = z.object({
  archonId: z.string().min(1),
  objectType: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  relationships: z.array(
    z.object({ kind: z.string(), targetArchonId: z.string() }),
  ),
  provenance: provenanceSchema,
  confidence: z.number().min(0).max(1).optional(),
});
export type CanonicalObjectInput = z.infer<typeof canonicalObjectInputSchema>;

// ---------------------------------------------------------------------------
// ChangeSet operations & snapshot
// ---------------------------------------------------------------------------
export const changeSetOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UPSERT_BRIEF"), brief: briefInputSchema }),
  z.object({ type: z.literal("UPSERT_RULE"), rule: ruleInputSchema }),
  z.object({ type: z.literal("DEACTIVATE_RULE"), ruleCode: z.string().min(1) }),
  z.object({
    type: z.literal("UPSERT_CANONICAL_OBJECT"),
    object: canonicalObjectInputSchema,
  }),
]);
export type ChangeSetOperation = z.infer<typeof changeSetOperationSchema>;

/** Authoritative canonical snapshot stored on every ProjectVersion. */
export interface CanonicalSnapshot {
  brief: BriefInput | null;
  rules: RuleInput[];
  canonicalObjects: CanonicalObjectInput[];
}

export const CHANGE_SET_SOURCES = [
  "USER",
  "AI_PROPOSAL",
  "CANVAS_PROMOTION",
  "SEED",
] as const;
export type ChangeSetSource = (typeof CHANGE_SET_SOURCES)[number];

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------
export interface ValidationCheckInput {
  category: string;
  status: ValidationStatus;
  severity: RuleSeverity;
  observedValue: string | null;
  expectedValue: string | null;
  unit: string | null;
  sourceType: SourceType;
  sourceReference: string | null;
  evidence: string;
  recommendation: string | null;
  confidence: number | null;
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------
export const CANVAS_PROMOTION_STATUSES = [
  "UNPROMOTED",
  "PROMOTION_PROPOSED",
  "PROMOTED",
] as const;
export type CanvasPromotionStatus = (typeof CANVAS_PROMOTION_STATUSES)[number];

export const canvasArtifactInputSchema = z.object({
  artifactType: z.string().min(1),
  title: z.string().min(1),
  status: z.string().default("ACTIVE"),
  parentArtifactIds: z.array(z.string()).default([]),
  sourceType: sourceTypeSchema.default("USER_INPUT"),
  sourceReference: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CanvasArtifactInput = z.infer<typeof canvasArtifactInputSchema>;
