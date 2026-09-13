import {handleSandboxValidator} from '../../../../../../../../packages/autocad-plugin/sandbox-validator-handler.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){return handleSandboxValidator(request);}
