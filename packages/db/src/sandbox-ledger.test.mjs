import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createSandboxSubmissionLedger} from './sandbox-ledger.mjs';

test('invalid keys and private database failures fail closed',async()=>{
 let calls=0;const ledger=createSandboxSubmissionLedger(async()=>{calls++;throw Error('postgres://private-secret');});
 await assert.rejects(ledger.claim({runId:"x'; DROP TABLE projects;--",manifestSha256:'a'.repeat(64),approvalReference:'test'}),/RUN_INVALID/);assert.equal(calls,0);
 await assert.rejects(ledger.lookup('test'),/^Error: SANDBOX_LEDGER_UNAVAILABLE$/);
});
test('PostgreSQL concurrent claims, restarts and ambiguous outcomes never permit resubmission',{skip:!process.env.ARCHON_LEDGER_TEST_DATABASE_URL},async()=>{
 const {default:postgres}=await import('postgres');
 const sql=postgres(process.env.ARCHON_LEDGER_TEST_DATABASE_URL,{max:10,prepare:false});
 const other=postgres(process.env.ARCHON_LEDGER_TEST_DATABASE_URL,{max:2,prepare:false});
 const a=createSandboxSubmissionLedger((q,p)=>sql.unsafe(q,p)),b=createSandboxSubmissionLedger((q,p)=>other.unsafe(q,p));
 const ids=[];
 try {
  // CI database is disposable; migrations run before this integration test.
  const runId=randomUUID();ids.push(runId);const claim={runId,manifestSha256:'a'.repeat(64),approvalReference:'test-approval'};
  const claims=await Promise.allSettled(Array.from({length:30},()=>a.claim(claim)));
  assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await b.lookup(runId)).state,'CLAIMED');
  const begins=await Promise.allSettled([a.beginSubmission(runId),b.beginSubmission(runId)]);assert.equal(begins.filter(r=>r.status==='fulfilled').length,1);
  // A recreated client observes the durable claim after a crash before provider acknowledgement.
  await assert.rejects(b.claim(claim),/ALREADY_CLAIMED/);await assert.rejects(b.beginSubmission(runId),/STATE_CONFLICT/);
  await b.markUnknown(runId);assert.equal((await a.lookup(runId)).state,'UNKNOWN');await assert.rejects(a.beginSubmission(runId),/STATE_CONFLICT/);
  const completed=randomUUID();ids.push(completed);await a.claim({...claim,runId:completed});await a.beginSubmission(completed);await a.markSubmitted(completed,'provider-workitem-1');
  assert.equal((await b.lookup(completed)).workitem_id,'provider-workitem-1');await assert.rejects(b.markSubmitted(completed,'provider-workitem-2'),/STATE_CONFLICT/);
  const collision=randomUUID();ids.push(collision);await a.claim({...claim,runId:collision});await a.beginSubmission(collision);await assert.rejects(a.markSubmitted(collision,'provider-workitem-1'),/LEDGER_UNAVAILABLE/);assert.equal((await b.lookup(collision)).state,'SUBMITTING');
 } finally {await sql.unsafe('DELETE FROM archon_sandbox_submissions WHERE run_id = ANY($1::text[])',[ids]);await sql.end();await other.end();}
});
