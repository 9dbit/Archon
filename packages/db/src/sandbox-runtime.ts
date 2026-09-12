import postgres from 'postgres';
import {activateSandboxLedgerTransaction} from './sandbox-activation.mjs';
import {createSandboxSubmissionLedger} from './sandbox-ledger.mjs';
import type {SandboxLedgerRow} from './sandbox-ledger.mjs';
import {createSandboxReceiptStore} from './sandbox-receipt-store.mjs';
export async function activateSandboxLedger(databaseUrl:string) {
 if(!databaseUrl)throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try {return await activateSandboxLedgerTransaction(async work=>client.begin(async tx=>work(async(q,p)=>Array.from(await tx.unsafe(q,p)))));}finally{await client.end();}
}
export async function withSandboxReceiptStore<T>(databaseUrl:string,work:(store:ReturnType<typeof createSandboxReceiptStore>)=>Promise<T>){
 if(!databaseUrl||typeof work!=='function')throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try{return await work(createSandboxReceiptStore(async(q,p)=>Array.from(await client.unsafe(q,p))));}finally{await client.end();}
}
export async function inspectSandboxRun(databaseUrl:string,runId:string){
 if(!databaseUrl)throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try{
  const ledger=createSandboxSubmissionLedger(async(q,p)=>Array.from(await client.unsafe<SandboxLedgerRow[]>(q,p)));
  const row=await ledger.lookup(runId);
  return {ledgerReady:true,runId,state:row?.state??'UNCLAIMED'};
 }finally{await client.end();}
}
