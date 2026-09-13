CREATE TABLE IF NOT EXISTS public.archon_sandbox_validator_submissions (
  run_id text PRIMARY KEY REFERENCES public.archon_sandbox_submissions(run_id),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_evidence_sha256 text NOT NULL REFERENCES public.archon_sandbox_review_evidence(evidence_sha256),
  input_dwg_sha256 text NOT NULL CHECK (input_dwg_sha256 ~ '^[a-f0-9]{64}$'),
  activity_id text NOT NULL CHECK (activity_id ~ '^[A-Za-z0-9_.+-]{1,256}$'),
  state text NOT NULL DEFAULT 'CLAIMED' CHECK (state IN ('CLAIMED','SUBMITTING','SUBMITTED','UNKNOWN')),
  validator_workitem_id text UNIQUE CHECK (validator_workitem_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  diagnostic text CHECK (diagnostic ~ '^SANDBOX_[A-Z0-9_]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'SUBMITTED') = (validator_workitem_id IS NOT NULL)),
  CHECK ((state = 'UNKNOWN') = (diagnostic IS NOT NULL))
);
