ALTER TABLE public.archon_sandbox_validator_receipts DROP CONSTRAINT IF EXISTS archon_sandbox_validator_receipts_state_check;
ALTER TABLE public.archon_sandbox_validator_receipts DROP CONSTRAINT IF EXISTS archon_sandbox_validator_receipts_state_finalization_check;
ALTER TABLE public.archon_sandbox_validator_receipts ADD CONSTRAINT archon_sandbox_validator_receipts_state_finalization_check CHECK (state IN ('PREPARED','FINALIZING','CONSUMED','UNKNOWN'));
