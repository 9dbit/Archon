export const sandboxLedgerDDL="CREATE TABLE IF NOT EXISTS public.archon_sandbox_submissions (\n  run_id text PRIMARY KEY CHECK (run_id ~ '^[A-Za-z0-9_-]{1,80}$'),\n  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),\n  approval_reference text NOT NULL CHECK (approval_reference ~ '^[A-Za-z0-9_-]{1,128}$'),\n  state text NOT NULL DEFAULT 'CLAIMED' CHECK (state IN ('CLAIMED','SUBMITTING','SUBMITTED','UNKNOWN')),\n  workitem_id text UNIQUE CHECK (workitem_id ~ '^[A-Za-z0-9_-]{1,128}$'),\n  diagnostic text CHECK (diagnostic ~ '^SANDBOX_[A-Z0-9_]{1,100}$'),\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now(),\n  CHECK ((state = 'SUBMITTED') = (workitem_id IS NOT NULL))\n);\n";
export async function activateSandboxLedgerTransaction(transaction) {
 if(typeof transaction!=='function')throw Error('SANDBOX_DATABASE_REQUIRED');
 try {return await transaction(async query=>{
  await query('SELECT pg_advisory_xact_lock(74623051)',[]);
  await query(sandboxLedgerDDL,[]);
  const columns=await query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='archon_sandbox_submissions'",[]);
  const required={run_id:'text',manifest_sha256:'text',approval_reference:'text',state:'text',workitem_id:'text',diagnostic:'text',created_at:'timestamp with time zone',updated_at:'timestamp with time zone'};
  if(columns.length!==8||columns.some(c=>required[c.column_name]!==c.data_type)||['run_id','manifest_sha256','approval_reference','state','created_at','updated_at'].some(name=>columns.find(c=>c.column_name===name)?.is_nullable!=='NO'))throw Error('SANDBOX_LEDGER_SCHEMA_MISMATCH');
  const constraints=await query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.archon_sandbox_submissions'::regclass",[]);
  const definitions=constraints.map(c=>c.definition).join(' ');
  if(!definitions.includes('PRIMARY KEY (run_id)')||!definitions.includes('UNIQUE (workitem_id)')||!['CLAIMED','SUBMITTING','SUBMITTED','UNKNOWN','manifest_sha256','approval_reference','diagnostic','workitem_id IS NOT NULL'].every(value=>definitions.includes(value)))throw Error('SANDBOX_LEDGER_SCHEMA_MISMATCH');
  const migrations=await query("SELECT to_regclass('public.archon_migrations') AS table_name",[]);
  if(migrations[0]?.table_name)await query("INSERT INTO public.archon_migrations (id) VALUES ('0002_sandbox_submission_ledger') ON CONFLICT (id) DO NOTHING",[]);
  return {state:'SANDBOX_LEDGER_SCHEMA_VERIFIED',ledgerReady:true,canonicalGraphMutated:false,executionEnabled:false};
 });}catch(error){throw Error(error.message==='SANDBOX_LEDGER_SCHEMA_MISMATCH'?error.message:'SANDBOX_LEDGER_ACTIVATION_FAILED');}
}
