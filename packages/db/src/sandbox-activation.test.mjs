import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activateSandboxLedgerTransaction,sandboxLedgerDDL,sandboxReceiptDDL,sandboxReviewEvidenceDDL} from './sandbox-activation.mjs';
test('runtime activation uses exactly the additive migration DDL',()=>{
 assert.equal(sandboxLedgerDDL,readFileSync(new URL('../drizzle/0002_sandbox_submission_ledger.sql',import.meta.url),'utf8'));
 assert.equal(sandboxReceiptDDL,readFileSync(new URL('../drizzle/0003_sandbox_transport_receipts.sql',import.meta.url),'utf8'));
 assert.equal(sandboxReviewEvidenceDDL,readFileSync(new URL('../drizzle/0004_sandbox_review_evidence.sql',import.meta.url),'utf8'));
});
test('real activation is idempotent, keeps unrelated data, and rejects malformed existing schema',{skip:!process.env.ARCHON_LEDGER_TEST_DATABASE_URL},async()=>{
 const {default:postgres}=await import('postgres');const sql=postgres(process.env.ARCHON_LEDGER_TEST_DATABASE_URL,{max:1,prepare:false});
 const transaction=work=>sql.begin(tx=>work(async(q,p)=>Array.from(await tx.unsafe(q,p))));
 try {
  await sql.unsafe('CREATE TABLE IF NOT EXISTS archon_activation_sentinel (marker text)');await sql.unsafe("INSERT INTO archon_activation_sentinel VALUES ('approved-graph-unchanged')");
  const before=await sql.unsafe('SELECT count(*)::int AS count FROM archon_activation_sentinel');
  for(let i=0;i<2;i++){const result=await activateSandboxLedgerTransaction(transaction);assert.equal(result.ledgerReady,true);assert.equal(result.receiptStoreReady,true);assert.equal(result.reviewEvidenceStoreReady,true);}
  assert.deepEqual(await sql.unsafe('SELECT count(*)::int AS count FROM archon_activation_sentinel'),before);
  await assert.rejects(sql.begin(async tx=>{
   await tx.unsafe('ALTER TABLE public.archon_sandbox_transport_receipts DROP CONSTRAINT archon_sandbox_transport_receipts_run_id_fkey');
   await tx.unsafe('ALTER TABLE public.archon_sandbox_review_evidence DROP CONSTRAINT archon_sandbox_review_evidence_run_id_fkey');
   await tx.unsafe('ALTER TABLE public.archon_sandbox_validator_submissions DROP CONSTRAINT archon_sandbox_validator_submissions_run_id_fkey');
   await tx.unsafe('ALTER TABLE public.archon_sandbox_submissions DROP CONSTRAINT archon_sandbox_submissions_pkey');
   await activateSandboxLedgerTransaction(work=>work(async(q,p)=>Array.from(await tx.unsafe(q,p))));
  }),/SCHEMA_MISMATCH/);
  assert.equal((await activateSandboxLedgerTransaction(transaction)).ledgerReady,true);
 }finally{await sql.unsafe('DROP TABLE IF EXISTS archon_activation_sentinel');await sql.end();}
});
