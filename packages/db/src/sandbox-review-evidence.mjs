import {createHash} from 'node:crypto';
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export function createSandboxReviewEvidenceStore(query){
 if(typeof query!=='function')throw Error('SANDBOX_REVIEW_EVIDENCE_STORE_REQUIRED');
 return Object.freeze({async store(record){
  if(!record||!validId(record.runId)||!hex(record.manifestSha256)||!validId(record.workitemId)||!['ARTIFACTS_VALIDATED','NATIVE_REOPEN_VERIFIED'].includes(record.stage)||!hex(record.dwgSha256)||!hex(record.reportSha256)||record.approvalGranted!==false||record.reconciliation!=='PROPOSE_CHANGESET_ONLY'||typeof record.nativeDwgReopenVerified!=='boolean'||(record.stage==='ARTIFACTS_VALIDATED'&&record.nativeDwgReopenVerified))throw Error('SANDBOX_REVIEW_EVIDENCE_INVALID');
  const evidence=JSON.stringify({schemaVersion:1,runId:record.runId,manifestSha256:record.manifestSha256,workitemId:record.workitemId,stage:record.stage,dwgSha256:record.dwgSha256,reportSha256:record.reportSha256,nativeDwgReopenVerified:record.nativeDwgReopenVerified,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,checklist:record.checklist??[]});
  if(evidence.length>32768)throw Error('SANDBOX_REVIEW_EVIDENCE_INVALID');const digest=createHash('sha256').update(evidence).digest('hex');
  let rows;try{rows=await query('INSERT INTO public.archon_sandbox_review_evidence (evidence_sha256,run_id,manifest_sha256,workitem_id,stage,dwg_sha256,report_sha256,evidence,approval_granted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,false) ON CONFLICT DO NOTHING RETURNING evidence_sha256,run_id,manifest_sha256,workitem_id,stage,dwg_sha256,report_sha256,approval_granted,created_at',[digest,record.runId,record.manifestSha256,record.workitemId,record.stage,record.dwgSha256,record.reportSha256,evidence]);}catch{throw Error('SANDBOX_REVIEW_EVIDENCE_STORE_UNAVAILABLE');}
  if(rows.length!==1)throw Error('SANDBOX_REVIEW_EVIDENCE_NOT_STORED');return rows[0];
 }});
}
