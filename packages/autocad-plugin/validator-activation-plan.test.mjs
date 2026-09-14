import test from 'node:test';
import assert from 'node:assert/strict';
import {createValidatorActivationPlan} from './validator-activation-plan.mjs';

const now=()=>1_700_000_000_000,secret='f'.repeat(64);

test('missing namespace keeps validator activation fail closed without provider access',()=>{
 const plan=createValidatorActivationPlan({env:{},now});
 assert.equal(plan.state,'VALIDATOR_ACTIVATION_BLOCKED');
 assert.equal(plan.resourcePlan.state,'NAMESPACE_REQUIRED');
 assert.equal(plan.executionEnabled,false);
 assert.equal(plan.approvalGranted,false);
 assert.equal(plan.realApsJobSubmitted,false);
 assert.ok(plan.blockers.includes('ARCHON_APS_EXPECTED_NAMESPACE_REQUIRED'));
});

test('credentials and namespace produce a scoped apply plan without leaking secrets',()=>{
 const plan=createValidatorActivationPlan({env:{ARCHON_APS_EXPECTED_NAMESPACE:'owner',APS_CLIENT_ID:'client-id',APS_CLIENT_SECRET:'private-secret'},now});
 assert.equal(plan.state,'VALIDATOR_RESOURCE_APPLY_READY');
 assert.equal(plan.resourcePlan.state,'READY_FOR_OPERATOR_APPLY');
 assert.equal(plan.resourcePlan.activityId,'owner.ArchonValidateDrawing+v0_1');
 assert.deepEqual(plan.resourcePlan.excludedOperations,['NO_WORKITEM_SUBMISSION','NO_DWG_WRITE','NO_BUILDING_GRAPH_MUTATION','NO_PRODUCTION_CHANGESET_APPROVAL']);
 assert.equal(plan.commandPromptCenter.sandboxPreviewTrial,'READY_FOR_NEXT_CHECKPOINT');
 assert.equal(JSON.stringify(plan).includes('private-secret'),false);
 assert.equal(JSON.stringify(plan).includes('client-id'),false);
});

test('configured validator resource still keeps execution gates closed',()=>{
 const env={ARCHON_APS_EXPECTED_NAMESPACE:'owner',APS_CLIENT_ID:'client-id',APS_CLIENT_SECRET:'private-secret',APS_VALIDATOR_ACTIVITY_ID:'owner.ArchonValidateDrawing+v0_1',ARCHON_SANDBOX_VALIDATOR_RECEIPT_KEY:secret};
 const plan=createValidatorActivationPlan({env,now});
 assert.equal(plan.state,'VALIDATOR_RESOURCE_CONFIGURED_GATES_CLOSED');
 assert.equal(plan.resourcePlan.state,'CONFIGURED');
 assert.equal(plan.configuration.validatorActivityConfigured,true);
 assert.equal(plan.configuration.validatorReceiptKeyConfigured,true);
 assert.equal(plan.commandPromptCenter.realDwgRoundtripTrial,'BLOCKED_PENDING_EXPLICIT_EXECUTION_APPROVAL');
 assert.equal(plan.gates.validatorTransportEnabled,false);
 assert.equal(plan.executionEnabled,false);
});

test('mismatched validator activity and open gates block activation',()=>{
 const env={ARCHON_APS_EXPECTED_NAMESPACE:'owner',APS_VALIDATOR_ACTIVITY_ID:'other.ArchonValidateDrawing+v0_1',ARCHON_SANDBOX_VALIDATOR_ENDPOINT_ENABLED:'true',ARCHON_SANDBOX_VALIDATOR_ENDPOINT_EXPIRES_AT:String(now()+60_000),ARCHON_SANDBOX_VALIDATOR_ENDPOINT_TOKEN_SHA256:secret,ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED:'true'};
 const plan=createValidatorActivationPlan({env,now});
 assert.equal(plan.state,'VALIDATOR_ACTIVATION_BLOCKED');
 assert.ok(plan.blockers.includes('APS_VALIDATOR_ACTIVITY_ID_NAMESPACE_MISMATCH'));
 assert.ok(plan.blockers.includes('VALIDATOR_EXECUTION_GATES_SHOULD_REMAIN_CLOSED_UNTIL_EXPLICIT_APPROVAL'));
 assert.equal(plan.gates.validatorEndpoint.windowValid,true);
 assert.equal(JSON.stringify(plan).includes(secret),false);
});
