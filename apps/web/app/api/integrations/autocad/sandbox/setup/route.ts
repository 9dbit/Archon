import {activateSandboxLedger} from '@archon/db';
import {handleSandboxOperator} from '../../../../../../../../packages/autocad-plugin/sandbox-operator.mjs';
import {probeSandboxResources} from '../../../../../../../../packages/autocad-plugin/sandbox-resources.mjs';
import {probeSandboxArtifacts,prepareReviewedSandboxInput} from '../../../../../../../../packages/autocad-plugin/sandbox-artifacts.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 return handleSandboxOperator(request,{activate:()=>activateSandboxLedger(process.env.DATABASE_URL??''),probe:()=>probeSandboxResources(),artifacts:()=>probeSandboxArtifacts(),prepareInput:()=>prepareReviewedSandboxInput()});
}
