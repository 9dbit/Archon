import {withSandboxGovernanceStores} from '@archon/db';
import {handleSandboxValidator} from '../../../../../../../../packages/autocad-plugin/sandbox-validator-handler.mjs';
import {executeGovernedSandboxValidator} from '../../../../../../../../packages/autocad-plugin/sandbox-validator-execution.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 return handleSandboxValidator(request,{execute:()=>executeGovernedSandboxValidator({withStores:work=>withSandboxGovernanceStores(process.env.DATABASE_URL??'',work)})});
}
