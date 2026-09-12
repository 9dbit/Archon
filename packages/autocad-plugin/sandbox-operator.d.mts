export function handleSandboxOperator(request:Request,options?:{env?:Record<string,string|undefined>;activate?:()=>Promise<unknown>;probe?:()=>Promise<unknown>}):Promise<Response>;
