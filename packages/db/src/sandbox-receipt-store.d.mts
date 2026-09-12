export function createSandboxReceiptStore(query:(sql:string,params:string[])=>Promise<readonly Record<string,unknown>[]>):Record<string,(...args:any[])=>Promise<any>>;
