import {withSandboxGovernanceStores} from '@archon/db';
import {handleSandboxValidatorFinalization} from '../../../../../../../../../packages/autocad-plugin/sandbox-validator-finalization-handler.mjs';
import {finalizeGovernedSandboxValidator} from '../../../../../../../../../packages/autocad-plugin/sandbox-validator-finalization.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 return handleSandboxValidatorFinalization(request,{finalize:()=>finalizeGovernedSandboxValidator({withStores:work=>withSandboxGovernanceStores(process.env.DATABASE_URL??'',work)})});
}
