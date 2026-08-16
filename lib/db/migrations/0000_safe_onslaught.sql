CREATE TYPE "public"."approval_decision" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."change_set_state" AS ENUM('DRAFT', 'PROPOSED', 'SANDBOXED', 'VALIDATING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'COMMITTING', 'COMMITTED', 'VALIDATION_FAILED');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('UNPROMOTED', 'PROMOTION_PROPOSED', 'PROMOTED');--> statement-breakpoint
CREATE TYPE "public"."rule_severity" AS ENUM('INFO', 'WARNING', 'BLOCKER', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('PASS', 'WARNING', 'BLOCKER', 'CRITICAL');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_set_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"reviewer" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archon_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"object_type" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"relationships" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"provenance" jsonb NOT NULL,
	"confidence" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_objects_archon_id_unique" UNIQUE("archon_id")
);
--> statement-breakpoint
CREATE TABLE "canvas_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"artifact_type" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"authoritative" boolean DEFAULT false NOT NULL,
	"parent_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_type" text NOT NULL,
	"source_reference" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"promotion_status" "promotion_status" DEFAULT 'UNPROMOTED' NOT NULL,
	"promotion_change_set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"base_version_id" uuid,
	"source" text NOT NULL,
	"intent_summary" text NOT NULL,
	"operations" jsonb NOT NULL,
	"affected_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_locks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"state" "change_set_state" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"brief" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_briefs_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"subject" text NOT NULL,
	"operator" text NOT NULL,
	"expected_value" double precision NOT NULL,
	"unit" text NOT NULL,
	"source_type" text NOT NULL,
	"source_reference" text,
	"severity" "rule_severity" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"parent_version_id" uuid,
	"snapshot" jsonb NOT NULL,
	"approved_change_set_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_versions_approved_change_set_id_unique" UNIQUE("approved_change_set_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"building_type" text NOT NULL,
	"location_text" text,
	"current_approved_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_set_id" uuid NOT NULL,
	"category" text NOT NULL,
	"status" "validation_status" NOT NULL,
	"severity" "rule_severity" NOT NULL,
	"observed_value" text,
	"expected_value" text,
	"unit" text,
	"source_type" text NOT NULL,
	"source_reference" text,
	"evidence" text NOT NULL,
	"recommendation" text,
	"confidence" double precision,
	"reviewer_note" text,
	"waiver_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_objects" ADD CONSTRAINT "canonical_objects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_artifacts" ADD CONSTRAINT "canvas_artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_rules" ADD CONSTRAINT "project_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_checks" ADD CONSTRAINT "validation_checks_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;