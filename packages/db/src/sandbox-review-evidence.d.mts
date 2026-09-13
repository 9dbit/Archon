export function createSandboxReviewEvidenceStore(query:(sql:string,params:unknown[])=>Promise<any[]>):{store(record:any):Promise<any>};
