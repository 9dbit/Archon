import postgres from 'postgres';
import {activateSandboxLedgerTransaction} from './sandbox-activation.mjs';
import {createSandboxSubmissionLedger} from './sandbox-ledger.mjs';
export async function activateSandboxLedger(databaseUrl:string) {
 if(!databaseUrl)throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try {return await activateSandboxLedgerTransaction(async work=>client.begin(async tx=>work(async(q,p)=>Array.from(await tx.unsafe(q,p)))));}finally{await client.end();}
}
export async function inspectSandboxRun(databaseUrl:string,runId:string){
 if(!databaseUrl)throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try{
  const ledger=createSandboxSubmissionLedger(async(q,p)=>Array.from(await client.unsafe(q,p)));
  const row=await ledger.lookup(runId);
  return {ledgerReady:true,runId,state:row?.state??'UNCLAIMED'};
 }finally{await client.end();}
}
