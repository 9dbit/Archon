import {createSandboxManifest} from './sandbox-manifest.mjs';
import {sandboxInput} from './sandbox-fixture.mjs';
import {probeSandboxArtifacts} from './sandbox-artifacts.mjs';
const runId='archon-layout-smoke-20260912-v1';
export function createPinnedSandboxReview(env){
 const namespace=env.APS_ACTIVITY_ID?.split('.')[0];
 const resources={namespace,engine:env.APS_AUTOCAD_ENGINE,activityId:env.APS_ACTIVITY_ID,appBundleId:env.APS_APPBUNDLE_ID,activityVersion:1,appBundleVersion:1,bundleSha256:'b6e8bf081b3267d87efc4c1dcee92e8aaacb3585d33a07365bc0a21487636bad'};
 return createSandboxManifest({inputBytes:Buffer.from(sandboxInput),expectedInputSha256:'70f9fab1673d29d82c71ceb75e56d5b13865900b772ffccc6dd1153baa18b3ff',runId,resources,seed:{state:'SEED_STORED_IN_SANDBOX',storedBytesVerified:true,executionEnabled:false,bucketKey:'archon_sandbox_d3fe3a147f41a17c347c2f2b',objectKey:'archon-seed-c935e19c89274600/seed.dwg',bytes:37894226,sha256:'17fbfaa1f29dce4444844cfbc7eb553077bef957ee3d605f4a56538597c4da80',dwgHeader:'AC1024'}});
}
export async function prepareSandboxSubmissionReview({env=process.env,fetcher=fetch,inspectRun,probe=probeSandboxArtifacts,now=Date.now}={}){
 const review=createPinnedSandboxReview(env);
 if(typeof inspectRun!=='function')throw Error('SANDBOX_LEDGER_REQUIRED');
 const ledger=await inspectRun(runId);
 if(ledger?.ledgerReady!==true||ledger.runId!==runId||ledger.state!=='UNCLAIMED')throw Error('SANDBOX_RUN_UNAVAILABLE');
 const status=await probe({env,fetcher});
 if(status?.runId!==runId||status.bundleBytesReverified!==true||status.outputsAbsent!==true||status.executionEnabled!==false||status.checks?.length!==2||!['seed','input'].every(name=>status.checks.some(c=>c.artifact===name&&c.status==='VERIFIED'&&c.bytesVerified===true)))throw Error('SANDBOX_REVIEW_PREFLIGHT_REQUIRED');
 return {state:'SANDBOX_SUBMISSION_REVIEW_PREPARED',...review,checkedAt:new Date(now()).toISOString(),ledgerReady:true,runUnclaimed:true,artifactBytesVerified:true,outputsAbsent:true,executionEnabled:false,approvalGranted:false,checklist:[{category:'pinned bundle / seed / input bytes',status:'PASS'},{category:'durable ledger / run unclaimed',status:'PASS'},{category:'output destinations empty',status:'PASS'},{category:'signed execution grant / fresh private transport',status:'PENDING'},{category:'native saved-DWG / design / materials / rules',status:'PENDING'}],pending:['PRIVATE_TRANSPORT_SESSION_AT_SUBMISSION','EXPLICIT_SANDBOX_EXECUTION_APPROVAL','POST_JOB_NATIVE_DWG_AND_ARCHON_REVIEW']};
}
