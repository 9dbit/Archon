CREATE TABLE "sketchup_execution_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_hash" text NOT NULL,
  "draft_fingerprint" text NOT NULL,
  "project_ref" text,
  "proposed_change_set_id" text NOT NULL,
  "drawing_ir_fingerprint" text NOT NULL,
  "payload" jsonb NOT NULL,
  "state" text DEFAULT 'APPROVED_LOCKED' NOT NULL,
  "execution_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sketchup_execution_packages_hash_format" CHECK ("package_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "sketchup_execution_packages_state_locked" CHECK ("state" = 'APPROVED_LOCKED'),
  CONSTRAINT "sketchup_execution_packages_execution_locked" CHECK ("execution_enabled" = false)
);

CREATE UNIQUE INDEX "sketchup_execution_packages_hash_uq"
  ON "sketchup_execution_packages" ("package_hash");
CREATE UNIQUE INDEX "sketchup_execution_packages_changeset_uq"
  ON "sketchup_execution_packages" ("proposed_change_set_id");
CREATE INDEX "sketchup_execution_packages_drawing_fp_idx"
  ON "sketchup_execution_packages" ("drawing_ir_fingerprint");

CREATE TABLE "sketchup_execution_package_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_id" uuid NOT NULL REFERENCES "sketchup_execution_packages"("id") ON DELETE restrict,
  "decision" text NOT NULL,
  "approved_by" text NOT NULL,
  "note" text,
  "expected_drawing_ir_fingerprint" text NOT NULL,
  "expected_proposed_change_set_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sketchup_execution_package_approval_decision" CHECK ("decision" = 'APPROVE_EXECUTION_PACKAGE')
);

CREATE UNIQUE INDEX "sketchup_execution_package_approvals_package_uq"
  ON "sketchup_execution_package_approvals" ("package_id");

CREATE FUNCTION archon_reject_sketchup_execution_package_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ARCHON_SKETCHUP_EXECUTION_PACKAGE_IMMUTABLE';
END;
$$;

CREATE TRIGGER sketchup_execution_packages_immutable
BEFORE UPDATE OR DELETE ON "sketchup_execution_packages"
FOR EACH ROW EXECUTE FUNCTION archon_reject_sketchup_execution_package_mutation();

CREATE TRIGGER sketchup_execution_package_approvals_immutable
BEFORE UPDATE OR DELETE ON "sketchup_execution_package_approvals"
FOR EACH ROW EXECUTE FUNCTION archon_reject_sketchup_execution_package_mutation();
