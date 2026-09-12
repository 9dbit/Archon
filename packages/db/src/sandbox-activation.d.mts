export const sandboxLedgerDDL:string;
export const sandboxReceiptDDL:string;
export function activateSandboxLedgerTransaction(transaction:(work:(query:(text:string,params:string[])=>Promise<any[]>)=>Promise<any>)=>Promise<any>):Promise<{state:string;ledgerReady:true;receiptStoreReady:true;canonicalGraphMutated:false;executionEnabled:false}>;
