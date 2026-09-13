import {withSandboxGovernanceStores} from '@archon/db';
import {handleSandboxFinalization} from '../../../../../../../../packages/autocad-plugin/sandbox-finalization-handler.mjs';
import {finalizeGovernedSandbox} from '../../../../../../../../packages/autocad-plugin/sandbox-lifecycle.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 return handleSandboxFinalization(request,{finalize:()=>finalizeGovernedSandbox({withStores:work=>withSandboxGovernanceStores(process.env.DATABASE_URL??'',work)})});
}
