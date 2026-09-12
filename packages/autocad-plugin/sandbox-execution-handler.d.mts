export function handleSandboxExecution(request:Request,options?:{env?:Record<string,string|undefined>;execute?:(approvalToken:string)=>Promise<unknown>}):Promise<Response>;
