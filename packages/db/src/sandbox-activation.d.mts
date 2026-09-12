export const sandboxLedgerDDL:string;
export function activateSandboxLedgerTransaction(transaction:(work:(query:(text:string,params:string[])=>Promise<any[]>)=>Promise<any>)=>Promise<any>):Promise<{state:string;ledgerReady:true;canonicalGraphMutated:false;executionEnabled:false}>;
