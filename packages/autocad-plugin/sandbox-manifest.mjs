import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);

// This is a review contract, never an execution grant or executable provider payload.
export function createSandboxManifest({inputBytes,expectedInputSha256,seed,resources,runId}) {
  if(!Buffer.isBuffer(inputBytes)||inputBytes.length<1||inputBytes.length>16*1024*1024||expectedInputSha256!=='70f9fab1673d29d82c71ceb75e56d5b13865900b772ffccc6dd1153baa18b3ff'||hash(inputBytes)!==expectedInputSha256) throw Error('SANDBOX_INPUT_DIGEST_MISMATCH');
  let input;try {input=JSON.parse(inputBytes);} catch {throw Error('SANDBOX_INPUT_INVALID');}
  const source=input?.source;
  if(input.schemaVersion!==1||input.units!=='mm'||input.coordinateMapping!=='ARCHON_XZ_TO_CAD_XY'||source?.projectId!=='test-only'||source.versionId!=='test-version'||source.changeSetId!=='test-preview-reference'||source.mode!=='PREVIEW'||source.level!=='Ground Floor'||input.executionEnabled!==false||input.reconciliation!=='PROPOSE_CHANGESET_ONLY'||!Array.isArray(input.entities)||input.entities.length!==7) throw Error('SANDBOX_TEST_ONLY_REQUIRED');
  if(!id(runId)||seed?.state!=='SEED_STORED_IN_SANDBOX'||seed.storedBytesVerified!==true||seed.executionEnabled!==false||!hex(seed.sha256)||!Number.isInteger(seed.bytes)||seed.bytes<100||seed.bytes>64*1024*1024||seed.dwgHeader!=='AC1024'||!/^archon_sandbox_[a-f0-9]{24}$/.test(seed.bucketKey??'')||! /^[A-Za-z0-9_-]{1,80}\/seed\.dwg$/.test(seed.objectKey??'')) throw Error('SANDBOX_VERIFIED_SEED_REQUIRED');
  if(!id(resources?.namespace)||resources.engine!=='Autodesk.AutoCAD+25_1'||resources.activityId!==resources.namespace+'.ArchonGenerateLayout+v0_1'||resources.appBundleId!==resources.namespace+'.ArchonLayoutBundle+v0_1'||resources.activityVersion!==1||resources.appBundleVersion!==1||!hex(resources.bundleSha256)) throw Error('SANDBOX_PINNED_RESOURCES_REQUIRED');
  const manifest={schemaVersion:1,scope:'ISOLATED_SYNTHETIC_LAYOUT_TEST',runId,
    source:{projectId:source.projectId,versionId:source.versionId,changeSetId:source.changeSetId,mode:source.mode,level:source.level},
    resources:{namespace:resources.namespace,engine:resources.engine,activityId:resources.activityId,activityVersion:1,appBundleId:resources.appBundleId,appBundleVersion:1,bundleSha256:resources.bundleSha256},
    inputs:{seedDwg:{bucketKey:seed.bucketKey,objectKey:seed.objectKey,bytes:seed.bytes,sha256:seed.sha256,dwgHeader:seed.dwgHeader,localName:'seed.dwg',verb:'get',storedBytesVerified:true},inputJson:{objectKey:runId+'/archon-input.json',bytes:inputBytes.length,sha256:hash(inputBytes),localName:'archon-input.json',verb:'get'}},
    outputs:{outputDwg:{objectKey:runId+'/archon-output.dwg',localName:'archon-output.dwg',verb:'put'},report:{objectKey:runId+'/archon-report.json',localName:'archon-report.json',verb:'put'}},
    expected:{entityCount:7,units:'mm',coordinateMapping:'ARCHON_XZ_TO_CAD_XY',layers:['ARCHON_SITE','ARCHON_WALLS','ARCHON_ROOMS','ARCHON_DIMS'],seedMutation:false,newOutputDatabase:true},
    executionEnabled:false,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY',
    pending:['LIVE_RESOURCE_VERSION_AND_BUNDLE_DIGEST_RECHECK','INPUT_STORAGE_AND_OUTPUT_ABSENCE_CHECK','FRESH_PRIVATE_TRANSPORT_CAPABILITIES','DURABLE_SUBMISSION_LEDGER','EXPLICIT_SANDBOX_JOB_APPROVAL','NATIVE_SEED_OPEN_AND_SAVED_DWG_VALIDATION']};
  return {manifest,manifestSha256:hash(Buffer.from(JSON.stringify(manifest)))};
}
