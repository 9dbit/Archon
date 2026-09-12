CREATE TABLE IF NOT EXISTS public.archon_sandbox_transport_receipts (
  run_id text PRIMARY KEY REFERENCES public.archon_sandbox_submissions(run_id),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  ciphertext text NOT NULL CHECK (length(ciphertext) BETWEEN 1 AND 16384),
  iv text NOT NULL CHECK (iv ~ '^[a-f0-9]{24}$'),
  auth_tag text NOT NULL CHECK (auth_tag ~ '^[a-f0-9]{32}$'),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'PREPARED' CHECK (state IN ('PREPARED','FINALIZING','CONSUMED','UNKNOWN')),
  diagnostic text CHECK (diagnostic ~ '^SANDBOX_[A-Z0-9_]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'UNKNOWN') = (diagnostic IS NOT NULL))
);
