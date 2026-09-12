export function handleSeedUpload(request: Request, env?: Record<string,string|undefined>, fetcher?: typeof fetch): Promise<Response>;
export function uploadSeed(args: {bytes: Buffer; runId: string; env?: Record<string,string|undefined>; fetcher?: typeof fetch}): Promise<Record<string,unknown>>;
