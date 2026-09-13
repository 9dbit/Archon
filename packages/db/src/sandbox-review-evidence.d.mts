export function createSandboxReviewEvidenceStore(query:(sql:string,params:unknown[])=>Promise<any[]>):{store(record:any):Promise<any>;lookup(runId:string,stage:string):Promise<any>};
