import {activateSandboxLedger} from '@archon/db';
import {handleSandboxOperator} from '../../../../../../../../packages/autocad-plugin/sandbox-operator.mjs';
import {probeSandboxResources} from '../../../../../../../../packages/autocad-plugin/sandbox-resources.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 return handleSandboxOperator(request,{activate:()=>activateSandboxLedger(process.env.DATABASE_URL??''),probe:()=>probeSandboxResources()});
}
