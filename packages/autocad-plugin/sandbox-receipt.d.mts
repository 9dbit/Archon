export type SealedSandboxReceipt={schemaVersion:1;runId:string;manifestSha256:string;ciphertext:string;iv:string;authTag:string;expiresAt:string;state:'PREPARED'};
export function sealSandboxReceipt(options:{receipt:Record<string,unknown>;runId:string;manifestSha256:string;secret:string;now?:()=>number}):SealedSandboxReceipt;
export function openSandboxReceipt(options:{record:SealedSandboxReceipt;runId:string;manifestSha256:string;secret:string;now?:()=>number}):Readonly<Record<string,unknown>>;
