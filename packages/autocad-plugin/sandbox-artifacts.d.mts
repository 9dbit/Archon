export function probeSandboxArtifacts(options?:{env?:Record<string,string|undefined>;fetcher?:typeof fetch}):Promise<unknown>;
export function verifyArtifactResponse(response:Response,spec:{size:number;sha256:string;header?:string}):Promise<boolean>;
