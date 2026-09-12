import {activateSandboxLedger,inspectSandboxRun} from '@archon/db';
import {handleSandboxOperator} from '../../../../../../../../packages/autocad-plugin/sandbox-operator.mjs';
import {probeSandboxResources} from '../../../../../../../../packages/autocad-plugin/sandbox-resources.mjs';
import {probeSandboxArtifacts,prepareReviewedSandboxInput} from '../../../../../../../../packages/autocad-plugin/sandbox-artifacts.mjs';
import {prepareSandboxSubmissionReview} from '../../../../../../../../packages/autocad-plugin/sandbox-review.mjs';
import {prepareSandboxTransportPreview} from '../../../../../../../../packages/autocad-plugin/sandbox-transport.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const inspectRun=runId=>inspectSandboxRun(process.env.DATABASE_URL??'',runId);
 return handleSandboxOperator(request,{activate:()=>activateSandboxLedger(process.env.DATABASE_URL??''),probe:()=>probeSandboxResources(),artifacts:()=>probeSandboxArtifacts(),prepareInput:()=>prepareReviewedSandboxInput(),review:()=>prepareSandboxSubmissionReview({inspectRun}),transport:()=>prepareSandboxTransportPreview({inspectRun})});
}
