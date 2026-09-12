const validRun=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const fields='run_id, manifest_sha256, approval_reference, state, workitem_id, diagnostic, created_at, updated_at';
// Caller supplies the private postgres-js query adapter. No credentials or URLs are stored.
export function createSandboxSubmissionLedger(query) {
  if(typeof query!=='function') throw Error('SANDBOX_LEDGER_REQUIRED');
  const run=value=>{if(!validRun(value)) throw Error('SANDBOX_RUN_INVALID');};
  const execute=async(text,params)=>{try{return await query(text,params);}catch{throw Error('SANDBOX_LEDGER_UNAVAILABLE');}};
  const transition=async(runId,from,to,extra='',params=[])=>{
    run(runId);
    const rows=await execute(`UPDATE archon_sandbox_submissions SET state=$2, updated_at=now()${extra} WHERE run_id=$1 AND state=$3 RETURNING ${fields}`,[runId,to,from,...params]);
    if(rows.length!==1) throw Error('SANDBOX_LEDGER_STATE_CONFLICT');return rows[0];
  };
  return Object.freeze({
    async claim({runId,manifestSha256,approvalReference}) {
      run(runId);
      if(typeof manifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(manifestSha256)||typeof approvalReference!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(approvalReference)) throw Error('SANDBOX_CLAIM_INVALID');
      const rows=await execute(`INSERT INTO archon_sandbox_submissions (run_id,manifest_sha256,approval_reference) VALUES ($1,$2,$3) ON CONFLICT (run_id) DO NOTHING RETURNING ${fields}`,[runId,manifestSha256,approvalReference]);
      if(rows.length!==1) throw Error('SANDBOX_RUN_ALREADY_CLAIMED');return rows[0];
    },
    beginSubmission:runId=>transition(runId,'CLAIMED','SUBMITTING'),
    async markSubmitted(runId,workitemId) {
      if(typeof workitemId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(workitemId)) throw Error('SANDBOX_WORKITEM_INVALID');
      return transition(runId,'SUBMITTING','SUBMITTED',', workitem_id=$4',[workitemId]);
    },
    async markUnknown(runId,diagnostic='SANDBOX_SUBMISSION_OUTCOME_UNKNOWN') {
      if(typeof diagnostic!=='string'||!/^SANDBOX_[A-Z0-9_]{1,100}$/.test(diagnostic)) throw Error('SANDBOX_DIAGNOSTIC_INVALID');
      return transition(runId,'SUBMITTING','UNKNOWN',', diagnostic=$4',[diagnostic]);
    },
    async lookup(runId) {run(runId);const rows=await execute(`SELECT ${fields} FROM archon_sandbox_submissions WHERE run_id=$1`,[runId]);return rows[0]??null;}
  });
}
