import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const changeSetState = pgEnum('change_set_state', ['DRAFT','PROPOSED','SANDBOXED','VALIDATING','NEEDS_REVIEW','APPROVED','REJECTED','COMMITTING','COMMITTED','VALIDATION_FAILED']);
export const validationStatus = pgEnum('validation_status', ['PASS','WARNING','BLOCKER','CRITICAL']);
export const artifactAuthority = pgEnum('artifact_authority', ['CANVAS','BUILDING']);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  buildingType: text('building_type'),
  locationText: text('location_text'),
  currentApprovedVersionId: uuid('current_approved_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const projectBriefs = pgTable('project_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  siteWidthMm: integer('site_width_mm'),
  siteDepthMm: integer('site_depth_mm'),
  targetGfaSqMm: integer('target_gfa_sq_mm'),
  levels: integer('levels'),
  floorToFloorHeights: jsonb('floor_to_floor_heights').$type<number[]>().default([]),
  programRequirements: jsonb('program_requirements').$type<Record<string, unknown>>().default({}),
  setbacks: jsonb('setbacks').$type<Record<string, unknown>>().default({}),
  notes: text('notes')
});

export const canvasArtifacts = pgTable('canvas_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  artifactType: text('artifact_type').notNull(),
  authority: artifactAuthority('authority').notNull().default('CANVAS'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  promotionStatus: text('promotion_status').notNull().default('NOT_PROMOTED'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const canonicalObjects = pgTable('canonical_objects', {
  id: uuid('id').defaultRandom().primaryKey(),
  archonId: text('archon_id').notNull().unique(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  objectType: text('object_type').notNull(),
  parameters: jsonb('parameters').$type<Record<string, unknown>>().default({}),
  relationships: jsonb('relationships').$type<Record<string, unknown>>().default({}),
  revision: integer('revision').notNull().default(1),
  provenance: jsonb('provenance').$type<Record<string, unknown>>().default({})
});

export const changeSets = pgTable('change_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  baseVersionId: uuid('base_version_id'),
  intentSummary: text('intent_summary').notNull(),
  operations: jsonb('operations').$type<Record<string, unknown>[]>().default([]),
  affectedDomains: jsonb('affected_domains').$type<string[]>().default([]),
  requestedLocks: jsonb('requested_locks').$type<string[]>().default([]),
  createdBy: text('created_by').notNull(),
  state: changeSetState('state').notNull().default('DRAFT'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (t) => ({ projectStateIdx: index('change_sets_project_state_idx').on(t.projectId, t.state) }));

export const validationFindings = pgTable('validation_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  changeSetId: uuid('change_set_id').references(() => changeSets.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull(),
  status: validationStatus('status').notNull(),
  observedValue: text('observed_value'),
  expectedValue: text('expected_value'),
  unit: text('unit'),
  sourceType: text('source_type').notNull(),
  sourceReference: text('source_reference').notNull(),
  evidence: text('evidence'),
  recommendation: text('recommendation'),
  confidencePermille: integer('confidence_permille').notNull().default(1000),
  reviewerNote: text('reviewer_note'),
  waiverReason: text('waiver_reason')
}, (t) => ({ changeSetIdx: index('validation_findings_change_set_idx').on(t.changeSetId) }));

export const approvals = pgTable('approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  changeSetId: uuid('change_set_id').references(() => changeSets.id, { onDelete: 'cascade' }).notNull(),
  decision: text('decision').notNull(),
  reviewer: text('reviewer').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const projectVersions = pgTable('project_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  parentVersionId: uuid('parent_version_id'),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  approvedChangeSetId: uuid('approved_change_set_id').references(() => changeSets.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (t) => ({
  approvedChangeSetUnique: uniqueIndex('project_versions_approved_change_set_uq').on(t.approvedChangeSetId),
  projectVersionUnique: uniqueIndex('project_versions_project_number_uq').on(t.projectId, t.versionNumber)
}));

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (t) => ({ projectCreatedIdx: index('audit_events_project_created_idx').on(t.projectId, t.createdAt) }));

export const adapterJobs = pgTable('adapter_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  changeSetId: uuid('change_set_id').references(() => changeSets.id, { onDelete: 'cascade' }).notNull(),
  adapterId: text('adapter_id').notNull(),
  capability: text('capability').notNull(),
  status: text('status').notNull().default('QUEUED'),
  diagnostics: jsonb('diagnostics').$type<string[]>().default([]),
  approvedStateMutated: boolean('approved_state_mutated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
