import {withSandboxGovernanceStores} from '@archon/db';
import {handleSandboxExecution} from '../../../../../../../../packages/autocad-plugin/sandbox-execution-handler.mjs';
import {executeGovernedSandbox} from '../../../../../../../../packages/autocad-plugin/sandbox-execution.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 return handleSandboxExecution(request,{execute:approvalToken=>executeGovernedSandbox({approvalToken,withStores:work=>withSandboxGovernanceStores(process.env.DATABASE_URL??'',work)})});
}
