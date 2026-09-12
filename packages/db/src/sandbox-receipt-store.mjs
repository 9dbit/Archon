const validRun=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const fields='run_id, manifest_sha256, ciphertext, iv, auth_tag, expires_at, state, diagnostic, created_at, updated_at';
export function createSandboxReceiptStore(query){
 if(typeof query!=='function')throw Error('SANDBOX_RECEIPT_STORE_REQUIRED');
 const execute=async(sql,params)=>{try{return await query(sql,params);}catch{throw Error('SANDBOX_RECEIPT_STORE_UNAVAILABLE');}};
 return Object.freeze({
  async storePrepared(record){
   if(record?.schemaVersion!==1||!validRun(record.runId)||!/^[a-f0-9]{64}$/.test(record.manifestSha256??'')||typeof record.ciphertext!=='string'||record.ciphertext.length<1||record.ciphertext.length>16384||!/^[a-f0-9]{24}$/.test(record.iv??'')||!/^[a-f0-9]{32}$/.test(record.authTag??'')||!Number.isFinite(Date.parse(record.expiresAt)))throw Error('SANDBOX_RECEIPT_RECORD_INVALID');
   const rows=await execute(`INSERT INTO public.archon_sandbox_transport_receipts (run_id,manifest_sha256,ciphertext,iv,auth_tag,expires_at) SELECT $1,$2,$3,$4,$5,$6::timestamptz FROM public.archon_sandbox_submissions WHERE run_id=$1 AND manifest_sha256=$2 AND state='SUBMITTING' ON CONFLICT (run_id) DO NOTHING RETURNING ${fields}`,[record.runId,record.manifestSha256,record.ciphertext,record.iv,record.authTag,record.expiresAt]);
   if(rows.length!==1)throw Error('SANDBOX_RECEIPT_NOT_STORED');return rows[0];
  },
  async claimFinalization(runId,manifestSha256,workitemId){
   if(!validRun(runId)||!/^[a-f0-9]{64}$/.test(manifestSha256??'')||typeof workitemId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(workitemId))throw Error('SANDBOX_RECEIPT_CLAIM_INVALID');
   const rows=await execute(`UPDATE public.archon_sandbox_transport_receipts r SET state='FINALIZING',updated_at=now() FROM public.archon_sandbox_submissions s WHERE r.run_id=$1 AND r.manifest_sha256=$2 AND r.state='PREPARED' AND r.expires_at>now() AND s.run_id=r.run_id AND s.manifest_sha256=r.manifest_sha256 AND s.state='SUBMITTED' AND s.workitem_id=$3 RETURNING r.${fields.replaceAll(', ', ', r.')}`,[runId,manifestSha256,workitemId]);
   if(rows.length!==1)throw Error('SANDBOX_RECEIPT_NOT_CLAIMABLE');return rows[0];
  },
  async markConsumed(runId){
   if(!validRun(runId))throw Error('SANDBOX_RUN_INVALID');const rows=await execute(`UPDATE public.archon_sandbox_transport_receipts SET state='CONSUMED',updated_at=now() WHERE run_id=$1 AND state='FINALIZING' RETURNING ${fields}`,[runId]);if(rows.length!==1)throw Error('SANDBOX_RECEIPT_STATE_CONFLICT');return rows[0];
  },
  async markUnknown(runId,diagnostic='SANDBOX_OUTPUT_FINALIZATION_UNKNOWN'){
   if(!validRun(runId)||typeof diagnostic!=='string'||!/^SANDBOX_[A-Z0-9_]{1,100}$/.test(diagnostic))throw Error('SANDBOX_RECEIPT_DIAGNOSTIC_INVALID');const rows=await execute(`UPDATE public.archon_sandbox_transport_receipts SET state='UNKNOWN',diagnostic=$2,updated_at=now() WHERE run_id=$1 AND state='FINALIZING' RETURNING ${fields}`,[runId,diagnostic]);if(rows.length!==1)throw Error('SANDBOX_RECEIPT_STATE_CONFLICT');return rows[0];
  },
  async lookup(runId){if(!validRun(runId))throw Error('SANDBOX_RUN_INVALID');const rows=await execute(`SELECT run_id,manifest_sha256,expires_at,state,diagnostic,created_at,updated_at FROM public.archon_sandbox_transport_receipts WHERE run_id=$1`,[runId]);return rows[0]??null;}
 });
}
