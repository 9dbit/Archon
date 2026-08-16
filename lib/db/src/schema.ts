import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  BriefInput,
  CanonicalObjectInput,
  CanonicalSnapshot,
  ChangeSetOperation,
} from "@workspace/domain";

export const changeSetStateEnum = pgEnum("change_set_state", [
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
]);

export const validationStatusEnum = pgEnum("validation_status", [
  "PASS",
  "WARNING",
  "BLOCKER",
  "CRITICAL",
]);

export const ruleSeverityEnum = pgEnum("rule_severity", [
  "INFO",
  "WARNING",
  "BLOCKER",
  "CRITICAL",
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "APPROVED",
  "REJECTED",
]);

export const promotionStatusEnum = pgEnum("promotion_status", [
  "UNPROMOTED",
  "PROMOTION_PROPOSED",
  "PROMOTED",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  buildingType: text("building_type").notNull(),
  locationText: text("location_text"),
  currentApprovedVersionId: uuid("current_approved_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectBriefs = pgTable("project_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  brief: jsonb("brief").$type<BriefInput>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const canvasArtifacts = pgTable("canvas_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  artifactType: text("artifact_type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  /** Always non-authoritative — enforced in application logic and tests. */
  authoritative: boolean("authoritative").notNull().default(false),
  parentArtifactIds: jsonb("parent_artifact_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  sourceType: text("source_type").notNull(),
  sourceReference: text("source_reference"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  promotionStatus: promotionStatusEnum("promotion_status")
    .notNull()
    .default("UNPROMOTED"),
  promotionChangeSetId: uuid("promotion_change_set_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const canonicalObjects = pgTable("canonical_objects", {
  id: uuid("id").primaryKey().defaultRandom(),
  archonId: text("archon_id").notNull().unique(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  relationships: jsonb("relationships")
    .$type<CanonicalObjectInput["relationships"]>()
    .notNull()
    .default([]),
  revision: integer("revision").notNull().default(1),
  provenance: jsonb("provenance")
    .$type<CanonicalObjectInput["provenance"]>()
    .notNull(),
  confidence: doublePrecision("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectRules = pgTable("project_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  operator: text("operator").notNull(),
  expectedValue: doublePrecision("expected_value").notNull(),
  unit: text("unit").notNull(),
  sourceType: text("source_type").notNull(),
  sourceReference: text("source_reference"),
  severity: ruleSeverityEnum("severity").notNull(),
  active: boolean("active").notNull().default(true),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const changeSets = pgTable("change_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  baseVersionId: uuid("base_version_id"),
  source: text("source").notNull(),
  intentSummary: text("intent_summary").notNull(),
  operations: jsonb("operations").$type<ChangeSetOperation[]>().notNull(),
  affectedDomains: jsonb("affected_domains")
    .$type<string[]>()
    .notNull()
    .default([]),
  requestedLocks: jsonb("requested_locks")
    .$type<string[]>()
    .notNull()
    .default([]),
  createdBy: text("created_by").notNull(),
  state: changeSetStateEnum("state").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const validationChecks = pgTable("validation_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  changeSetId: uuid("change_set_id")
    .notNull()
    .references(() => changeSets.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  status: validationStatusEnum("status").notNull(),
  severity: ruleSeverityEnum("severity").notNull(),
  observedValue: text("observed_value"),
  expectedValue: text("expected_value"),
  unit: text("unit"),
  sourceType: text("source_type").notNull(),
  sourceReference: text("source_reference"),
  evidence: text("evidence").notNull(),
  recommendation: text("recommendation"),
  confidence: doublePrecision("confidence"),
  reviewerNote: text("reviewer_note"),
  waiverReason: text("waiver_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  changeSetId: uuid("change_set_id")
    .notNull()
    .references(() => changeSets.id, { onDelete: "cascade" }),
  decision: approvalDecisionEnum("decision").notNull(),
  reviewer: text("reviewer").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectVersions = pgTable("project_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  parentVersionId: uuid("parent_version_id"),
  snapshot: jsonb("snapshot").$type<CanonicalSnapshot>().notNull(),
  /** Unique — the idempotency guarantee for commits. */
  approvedChangeSetId: uuid("approved_change_set_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  payload: jsonb("payload")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
