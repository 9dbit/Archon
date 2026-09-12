export function createPinnedSandboxReview(env:Record<string,string|undefined>):{manifest:Record<string,unknown>;manifestSha256:string};
export function prepareSandboxSubmissionReview(options?:{env?:Record<string,string|undefined>;fetcher?:typeof fetch;inspectRun?:(runId:string)=>Promise<unknown>;now?:()=>number}):Promise<unknown>;
