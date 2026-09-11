CREATE TYPE "change_set_state" AS ENUM ('DRAFT','PROPOSED','SANDBOXED','VALIDATING','NEEDS_REVIEW','APPROVED','REJECTED','COMMITTING','COMMITTED','VALIDATION_FAILED');
CREATE TYPE "validation_status" AS ENUM ('PASS','WARNING','BLOCKER','CRITICAL');
CREATE TYPE "artifact_authority" AS ENUM ('CANVAS','BUILDING');

CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'ACTIVE' NOT NULL,
  "building_type" text,
  "location_text" text,
  "current_approved_version_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "site_width_mm" integer,
  "site_depth_mm" integer,
  "target_gfa_sq_mm" integer,
  "levels" integer,
  "floor_to_floor_heights" jsonb DEFAULT '[]'::jsonb,
  "program_requirements" jsonb DEFAULT '{}'::jsonb,
  "setbacks" jsonb DEFAULT '{}'::jsonb,
  "notes" text
);

CREATE TABLE "canvas_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "artifact_type" text NOT NULL,
  "authority" "artifact_authority" DEFAULT 'CANVAS' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "promotion_status" text DEFAULT 'NOT_PROMOTED' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "canonical_objects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "archon_id" text NOT NULL UNIQUE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "object_type" text NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb,
  "relationships" jsonb DEFAULT '{}'::jsonb,
  "revision" integer DEFAULT 1 NOT NULL,
  "provenance" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE "change_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "base_version_id" uuid,
  "intent_summary" text NOT NULL,
  "operations" jsonb DEFAULT '[]'::jsonb,
  "affected_domains" jsonb DEFAULT '[]'::jsonb,
  "requested_locks" jsonb DEFAULT '[]'::jsonb,
  "created_by" text NOT NULL,
  "state" "change_set_state" DEFAULT 'DRAFT' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "validation_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "change_set_id" uuid NOT NULL REFERENCES "change_sets"("id") ON DELETE cascade,
  "category" text NOT NULL,
  "status" "validation_status" NOT NULL,
  "observed_value" text,
  "expected_value" text,
  "unit" text,
  "source_type" text NOT NULL,
  "source_reference" text NOT NULL,
  "evidence" text,
  "recommendation" text,
  "confidence_permille" integer DEFAULT 1000 NOT NULL,
  "reviewer_note" text,
  "waiver_reason" text
);

CREATE TABLE "approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "change_set_id" uuid NOT NULL REFERENCES "change_sets"("id") ON DELETE cascade,
  "decision" text NOT NULL,
  "reviewer" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "parent_version_id" uuid,
  "snapshot" jsonb NOT NULL,
  "approved_change_set_id" uuid NOT NULL REFERENCES "change_sets"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "project_versions_approved_change_set_uq" ON "project_versions" ("approved_change_set_id");
CREATE UNIQUE INDEX "project_versions_project_number_uq" ON "project_versions" ("project_id", "version_number");

CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "event_type" text NOT NULL,
  "actor" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "adapter_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "change_set_id" uuid NOT NULL REFERENCES "change_sets"("id") ON DELETE cascade,
  "adapter_id" text NOT NULL,
  "capability" text NOT NULL,
  "status" text DEFAULT 'QUEUED' NOT NULL,
  "diagnostics" jsonb DEFAULT '[]'::jsonb,
  "approved_state_mutated" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "change_sets_project_state_idx" ON "change_sets" ("project_id", "state");
CREATE INDEX "validation_findings_change_set_idx" ON "validation_findings" ("change_set_id");
CREATE INDEX "audit_events_project_created_idx" ON "audit_events" ("project_id", "created_at");
