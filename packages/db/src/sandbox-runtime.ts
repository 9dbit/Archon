import postgres from 'postgres';
import {activateSandboxLedgerTransaction} from './sandbox-activation.mjs';
export async function activateSandboxLedger(databaseUrl:string) {
 if(!databaseUrl)throw new Error('SANDBOX_DATABASE_REQUIRED');
 const client=postgres(databaseUrl,{max:1,prepare:false,connect_timeout:10});
 try {return await activateSandboxLedgerTransaction(async work=>client.begin(async tx=>work(async(q,p)=>Array.from(await tx.unsafe(q,p)))));}finally{await client.end();}
}
