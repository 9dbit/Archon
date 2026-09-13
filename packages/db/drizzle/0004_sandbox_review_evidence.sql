CREATE TABLE IF NOT EXISTS public.archon_sandbox_review_evidence (
  evidence_sha256 text PRIMARY KEY CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  run_id text NOT NULL REFERENCES public.archon_sandbox_submissions(run_id),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  workitem_id text NOT NULL CHECK (workitem_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  stage text NOT NULL CHECK (stage IN ('ARTIFACTS_VALIDATED','NATIVE_REOPEN_VERIFIED')),
  dwg_sha256 text NOT NULL CHECK (dwg_sha256 ~ '^[a-f0-9]{64}$'),
  report_sha256 text NOT NULL CHECK (report_sha256 ~ '^[a-f0-9]{64}$'),
  evidence jsonb NOT NULL,
  approval_granted boolean NOT NULL DEFAULT false CHECK (approval_granted = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, stage)
);
CREATE OR REPLACE FUNCTION public.archon_reject_review_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ARCHON_REVIEW_EVIDENCE_IMMUTABLE'; END $$;
DROP TRIGGER IF EXISTS archon_review_evidence_immutable ON public.archon_sandbox_review_evidence;
CREATE TRIGGER archon_review_evidence_immutable BEFORE UPDATE OR DELETE ON public.archon_sandbox_review_evidence FOR EACH ROW EXECUTE FUNCTION public.archon_reject_review_evidence_mutation();
