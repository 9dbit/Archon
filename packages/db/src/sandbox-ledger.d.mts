export type SandboxLedgerRow={run_id:string;manifest_sha256:string;approval_reference:string;state:'CLAIMED'|'SUBMITTING'|'SUBMITTED'|'UNKNOWN';workitem_id:string|null;diagnostic:string|null;created_at:Date;updated_at:Date};
export function createSandboxSubmissionLedger(query:(text:string,params:string[])=>Promise<readonly SandboxLedgerRow[]>):{
 claim(input:{runId:string;manifestSha256:string;approvalReference:string}):Promise<SandboxLedgerRow>;
 beginSubmission(runId:string):Promise<SandboxLedgerRow>;
 markSubmitted(runId:string,workitemId:string):Promise<SandboxLedgerRow>;
 markUnknown(runId:string,diagnostic?:string):Promise<SandboxLedgerRow>;
 lookup(runId:string):Promise<SandboxLedgerRow|null>;
};
