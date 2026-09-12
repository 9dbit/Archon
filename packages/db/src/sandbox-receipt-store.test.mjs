import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxReceiptStore} from './sandbox-receipt-store.mjs';
test('durable receipt requires SUBMITTING, finalization requires matching SUBMITTED workitem, and claims once',{skip:!process.env.ARCHON_LEDGER_TEST_DATABASE_URL},async()=>{
 const {default:postgres}=await import('postgres'),sql=postgres(process.env.ARCHON_LEDGER_TEST_DATABASE_URL,{max:5,prepare:false});
 const query=async(q,p)=>Array.from(await sql.unsafe(q,p)),store=createSandboxReceiptStore(query),runId='receipt_store_test',manifest='a'.repeat(64);
 const record={schemaVersion:1,runId,manifestSha256:manifest,ciphertext:Buffer.from('encrypted').toString('base64'),iv:'b'.repeat(24),authTag:'c'.repeat(32),expiresAt:new Date(Date.now()+600000).toISOString(),state:'PREPARED'};
 try{
  await sql.unsafe('DELETE FROM public.archon_sandbox_transport_receipts WHERE run_id=$1',[runId]);await sql.unsafe('DELETE FROM public.archon_sandbox_submissions WHERE run_id=$1',[runId]);
  await assert.rejects(store.storePrepared(record),/NOT_STORED/);
  await sql.unsafe("INSERT INTO public.archon_sandbox_submissions (run_id,manifest_sha256,approval_reference,state) VALUES ($1,$2,'receipt-test','SUBMITTING')",[runId,manifest]);
  assert.equal((await store.storePrepared(record)).state,'PREPARED');await assert.rejects(store.storePrepared(record),/NOT_STORED/);
  await assert.rejects(store.claimFinalization(runId,manifest,'workitem-1'),/NOT_CLAIMABLE/);
  await sql.unsafe("UPDATE public.archon_sandbox_submissions SET state='SUBMITTED',workitem_id='workitem-1' WHERE run_id=$1",[runId]);
  const claims=await Promise.allSettled(Array.from({length:12},()=>store.claimFinalization(runId,manifest,'workitem-1')));
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);assert.equal((await store.markConsumed(runId)).state,'CONSUMED');await assert.rejects(store.claimFinalization(runId,manifest,'workitem-1'),/NOT_CLAIMABLE/);
  const summary=await store.lookup(runId);assert.equal(summary.state,'CONSUMED');assert.equal('ciphertext' in summary,false);
 }finally{await sql.unsafe('DELETE FROM public.archon_sandbox_transport_receipts WHERE run_id=$1',[runId]);await sql.unsafe('DELETE FROM public.archon_sandbox_submissions WHERE run_id=$1',[runId]);await sql.end();}
});
