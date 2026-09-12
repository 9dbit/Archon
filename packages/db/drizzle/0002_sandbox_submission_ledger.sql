CREATE TABLE IF NOT EXISTS public.archon_sandbox_submissions (
  run_id text PRIMARY KEY CHECK (run_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  approval_reference text NOT NULL CHECK (approval_reference ~ '^[A-Za-z0-9_-]{1,128}$'),
  state text NOT NULL DEFAULT 'CLAIMED' CHECK (state IN ('CLAIMED','SUBMITTING','SUBMITTED','UNKNOWN')),
  workitem_id text UNIQUE CHECK (workitem_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  diagnostic text CHECK (diagnostic ~ '^SANDBOX_[A-Z0-9_]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'SUBMITTED') = (workitem_id IS NOT NULL))
);
