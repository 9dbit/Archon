export function createSandboxValidatorReceiptStore(query:(sql:string,params:any[])=>Promise<any[]>):{storePrepared(record:any):Promise<any>;lookup(runId:string):Promise<any>};
