import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSandboxManifest} from './sandbox-manifest.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const inputBytes=Buffer.from("{\"schemaVersion\":1,\"source\":{\"projectId\":\"test-only\",\"versionId\":\"test-version\",\"mode\":\"PREVIEW\",\"changeSetId\":\"test-preview-reference\",\"level\":\"Ground Floor\"},\"units\":\"mm\",\"coordinateMapping\":\"ARCHON_XZ_TO_CAD_XY\",\"entities\":[{\"kind\":\"POLYLINE\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_SITE\",\"closed\":true,\"pointsMm\":[[-5000,-4000],[5000,-4000],[5000,4000],[-5000,4000]]},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-5000,-4000],\"endMm\":[5000,-4000],\"axis\":\"X\",\"measuredMm\":10000},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-5000,-4000],\"endMm\":[-5000,4000],\"axis\":\"Z\",\"measuredMm\":8000},{\"kind\":\"POLYLINE\",\"sourceId\":\"test-wall\",\"revision\":1,\"layer\":\"ARCHON_WALLS\",\"closed\":true,\"pointsMm\":[[-5000,-4000],[5000,-4000],[5000,-3800],[-5000,-3800]]},{\"kind\":\"TEXT\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_ROOMS\",\"positionMm\":[0,0],\"text\":\"Kitchen\"},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-2000,-1500],\"endMm\":[2000,-1500],\"axis\":\"X\",\"measuredMm\":4000},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-2000,-1500],\"endMm\":[-2000,1500],\"axis\":\"Z\",\"measuredMm\":3000}],\"excludedObjectIds\":[],\"checklist\":[{\"category\":\"geometry\",\"status\":\"PASS\",\"evidence\":\"Finite axis-aligned boxes inside supplied site rectangle; explicit single level.\"},{\"category\":\"dimensions\",\"status\":\"PASS\",\"evidence\":\"Dimension values derived from source coordinates in millimetres.\"},{\"category\":\"scope\",\"status\":\"PASS\",\"evidence\":\"Only site, walls, room labels and dimensions supported; excluded IDs recorded.\"},{\"category\":\"design/materials/rules\",\"status\":\"WARNING\",\"evidence\":\"Serialization does not validate circulation, materials, topology or construction compliance.\"},{\"category\":\"approval\",\"status\":\"WARNING\",\"evidence\":\"Source reference is descriptive. Existing governance must independently verify approval and freshness before any execution.\"}],\"executionEnabled\":false,\"reconciliation\":\"PROPOSE_CHANGESET_ONLY\"}");
const config=()=>({inputBytes,expectedInputSha256:hash(inputBytes),runId:'test-run',seed:{state:'SEED_STORED_IN_SANDBOX',storedBytesVerified:true,executionEnabled:false,sha256:'a'.repeat(64),bytes:1000,dwgHeader:'AC1024',bucketKey:'archon_sandbox_'+ 'b'.repeat(24),objectKey:'seed-run/seed.dwg',extraToken:'private'},resources:{namespace:'test-namespace',engine:'Autodesk.AutoCAD+25_1',activityId:'test-namespace.ArchonGenerateLayout+v0_1',appBundleId:'test-namespace.ArchonLayoutBundle+v0_1',activityVersion:1,appBundleVersion:1,bundleSha256:'c'.repeat(64),oauthToken:'private'}});
test('deterministic review binds source, bytes, resource versions and unique output paths',()=>{
 const a=createSandboxManifest(config()),b=createSandboxManifest(config());assert.deepEqual(a,b);
 assert.equal(a.manifest.approvalGranted,false);assert.equal(a.manifest.executionEnabled,false);assert.equal(a.manifest.expected.entityCount,7);
 assert.equal(a.manifest.outputs.outputDwg.objectKey,'test-run/archon-output.dwg');assert.ok(!JSON.stringify(a).includes('private'));
 const c=config();c.runId='another-run';assert.notEqual(createSandboxManifest(c).manifestSha256,a.manifestSha256);
 const d=config();d.seed.sha256='d'.repeat(64);assert.notEqual(createSandboxManifest(d).manifestSha256,a.manifestSha256);
 assert.ok(a.manifest.pending.includes('DURABLE_SUBMISSION_LEDGER'));
});
test('changed fixture including production source cannot create a sandbox review',()=>{
 for(const edit of [j=>j.source.projectId='production',j=>j.entities[0].pointsMm[0][0]+=500,j=>j.units='m']) {
 const c=config(),j=JSON.parse(c.inputBytes);edit(j);c.inputBytes=Buffer.from(JSON.stringify(j));c.expectedInputSha256=hash(c.inputBytes);
 assert.throws(()=>createSandboxManifest(c),/INPUT_DIGEST_MISMATCH/);
 }
});
test('unverified seed, path traversal and changed resource versions fail closed',()=>{
 for(const edit of [c=>c.seed.storedBytesVerified=false,c=>c.seed.objectKey='../seed.dwg',c=>c.runId='../run',c=>c.resources.activityVersion=2,c=>c.resources.appBundleId='foreign.Bundle+alias',c=>c.seed.executionEnabled=true]) {
 const c=config();edit(c);assert.throws(()=>createSandboxManifest(c));
 }
});
