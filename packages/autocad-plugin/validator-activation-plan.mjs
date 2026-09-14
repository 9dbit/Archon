import {createValidatorActivityPlan} from './prepare-validator-activity.mjs';

const namespace=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const set=value=>typeof value==='string'&&value.trim().length>0;
const validatorActivity=value=>{const match=typeof value==='string'?value.match(/^([A-Za-z0-9_-]{1,80})\.ArchonValidateDrawing\+v0_1$/):null;return match?{namespace:match[1],activityId:value}:null;};
const check=(id,status,action,evidence)=>Object.freeze({id,status,action,evidence});
const gate=(env,prefix,now)=>{
 const enabled=env[prefix+'_ENABLED']==='true',expires=Number(env[prefix+'_EXPIRES_AT']),tokenConfigured=hex(env[prefix+'_TOKEN_SHA256']);
 const expiresAt=Number.isFinite(expires)?new Date(expires).toISOString():null,windowValid=enabled&&tokenConfigured&&expires>now&&expires<=now+31*60000;
 return Object.freeze({prefix,enabled,tokenConfigured,expiresAt,windowValid,state:windowValid?'OPEN_TEMPORARY':'CLOSED'});
};

export function createValidatorActivationPlan({env=process.env,now=Date.now}={}){
 const checkedAt=now(),expectedNamespace=namespace(env.ARCHON_APS_EXPECTED_NAMESPACE)?env.ARCHON_APS_EXPECTED_NAMESPACE:undefined,configuredValidator=validatorActivity(env.APS_VALIDATOR_ACTIVITY_ID);
 const resolvedNamespace=expectedNamespace??configuredValidator?.namespace,hasNamespace=namespace(resolvedNamespace),activityPlan=hasNamespace?createValidatorActivityPlan(resolvedNamespace):undefined;
 const validatorConfigured=Boolean(configuredValidator&&activityPlan&&configuredValidator.activityId===activityPlan.activityId);
 const validatorInvalid=set(env.APS_VALIDATOR_ACTIVITY_ID)&&!configuredValidator,validatorMismatch=Boolean(configuredValidator&&activityPlan&&configuredValidator.activityId!==activityPlan.activityId);
 const credentialsConfigured=set(env.APS_CLIENT_ID)&&set(env.APS_CLIENT_SECRET),receiptKeyConfigured=hex(env.ARCHON_SANDBOX_VALIDATOR_RECEIPT_KEY);
 const endpointGate=gate(env,'ARCHON_SANDBOX_VALIDATOR_ENDPOINT',checkedAt),finalizationGate=gate(env,'ARCHON_SANDBOX_VALIDATOR_FINALIZATION',checkedAt),setupGate=gate(env,'ARCHON_SANDBOX_SETUP',checkedAt);
 const transportEnabled=env.ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED==='true';
 const applyReady=hasNamespace&&credentialsConfigured&&!validatorInvalid&&!validatorMismatch&&!validatorConfigured;
 const state=!hasNamespace||validatorInvalid||validatorMismatch?'VALIDATOR_ACTIVATION_BLOCKED':validatorConfigured?'VALIDATOR_RESOURCE_CONFIGURED_GATES_CLOSED':credentialsConfigured?'VALIDATOR_RESOURCE_APPLY_READY':'VALIDATOR_RESOURCE_APPLY_BLOCKED';
 const blockers=[
  ...(!hasNamespace?['ARCHON_APS_EXPECTED_NAMESPACE_REQUIRED']:[]),
  ...(validatorInvalid?['APS_VALIDATOR_ACTIVITY_ID_INVALID']:[]),
  ...(validatorMismatch?['APS_VALIDATOR_ACTIVITY_ID_NAMESPACE_MISMATCH']:[]),
  ...(!credentialsConfigured&&!validatorConfigured?['APS_CLIENT_ID_AND_APS_CLIENT_SECRET_REQUIRED_FOR_APPLY']:[]),
  ...(!receiptKeyConfigured?['ARCHON_SANDBOX_VALIDATOR_RECEIPT_KEY_REQUIRED_BEFORE_SUBMISSION']:[]),
  ...(endpointGate.windowValid||finalizationGate.windowValid||transportEnabled?['VALIDATOR_EXECUTION_GATES_SHOULD_REMAIN_CLOSED_UNTIL_EXPLICIT_APPROVAL']:[])
 ];
 const resourcePlan=Object.freeze({
  scope:'VALIDATOR_ACTIVITY_ONLY',
  state:applyReady?'READY_FOR_OPERATOR_APPLY':validatorConfigured?'CONFIGURED':hasNamespace?'BLOCKED':'NAMESPACE_REQUIRED',
  namespace:resolvedNamespace??null,
  engine:activityPlan?.engine??'Autodesk.AutoCAD+25_1',
  activityId:activityPlan?.activityId??null,
  appBundleId:activityPlan?.appbundles?.[0]??null,
  alias:activityPlan?.alias??'v0_1',
  workerModes:['DISCOVER_VALIDATOR','APPLY_VALIDATOR'],
  applyOperations:['READ_AUTHENTICATED_NAMESPACE','VERIFY_AUTOCAD_ENGINE','VERIFY_LAYOUT_BUNDLE_ALIAS','ASSERT_VALIDATOR_ACTIVITY_ABSENT','CREATE_VALIDATOR_ACTIVITY','CREATE_VALIDATOR_ALIAS','READBACK_VERIFY_ACTIVITY'],
  excludedOperations:['NO_WORKITEM_SUBMISSION','NO_DWG_WRITE','NO_BUILDING_GRAPH_MUTATION','NO_PRODUCTION_CHANGESET_APPROVAL'],
  executionEnabled:false,
  approvalGranted:false,
  reconciliation:'PROPOSE_CHANGESET_ONLY'
 });
 return Object.freeze({
  schemaVersion:1,
  checkedAt:new Date(checkedAt).toISOString(),
  state,
  resourcePlan,
  configuration:Object.freeze({
   expectedNamespaceConfigured:hasNamespace,
   apsCredentialsConfigured:credentialsConfigured,
   validatorActivityConfigured:validatorConfigured,
   validatorReceiptKeyConfigured:receiptKeyConfigured
  }),
  gates:Object.freeze({setup:setupGate,validatorEndpoint:endpointGate,validatorFinalization:finalizationGate,validatorTransportEnabled:transportEnabled}),
  checklist:Object.freeze([
   check('VALIDATOR_NAMESPACE',hasNamespace?'PASS':'BLOCKED','Configure ARCHON_APS_EXPECTED_NAMESPACE to the authenticated APS app namespace.',hasNamespace?'namespace available':'missing'),
   check('VALIDATOR_ACTIVITY_DRY_RUN',hasNamespace?'READY':'BLOCKED','Run DISCOVER_VALIDATOR first and compare the non-secret activity plan.',hasNamespace?'dry-run can be generated':'namespace required'),
   check('VALIDATOR_ACTIVITY_APPLY',applyReady?'READY':validatorConfigured?'PASS':'BLOCKED','Run APPLY_VALIDATOR only after namespace and bundle alias are verified.',validatorConfigured?'APS_VALIDATOR_ACTIVITY_ID configured':applyReady?'credentials and namespace present':'apply prerequisites incomplete'),
   check('VALIDATOR_RECEIPT_KEY',receiptKeyConfigured?'PASS':'PENDING','Set a durable 64-hex ARCHON_SANDBOX_VALIDATOR_RECEIPT_KEY before any validator submission window.',receiptKeyConfigured?'configured':'not configured'),
   check('VALIDATOR_GATES_CLOSED',!endpointGate.windowValid&&!finalizationGate.windowValid&&!transportEnabled?'PASS':'BLOCKED','Keep endpoint, transport and finalization gates closed until explicit execution approval.',!endpointGate.windowValid&&!finalizationGate.windowValid&&!transportEnabled?'closed':'one or more validator gates open'),
   check('COMMAND_PROMPT_CENTER_SANDBOX','READY','Start with prompt-to-Intent-to-Proposed-ChangeSet preview/diff only; real DWG roundtrip stays locked.',validatorConfigured?'native validator resource configured':'can proceed as governed preview UI while APS remains locked')
  ]),
  commandPromptCenter:Object.freeze({
   sandboxPreviewTrial:'READY_FOR_NEXT_CHECKPOINT',
   sandboxPreviewMode:'PROMPT_TO_INTENT_TO_PROPOSED_CHANGESET_PREVIEW',
   realDwgRoundtripTrial:validatorConfigured&&receiptKeyConfigured&&!transportEnabled&&!endpointGate.windowValid&&!finalizationGate.windowValid?'BLOCKED_PENDING_EXPLICIT_EXECUTION_APPROVAL':'BLOCKED_PENDING_VALIDATOR_ACTIVATION',
   requiresApsForPreview:false,
   requiresApsForRealDwgRoundtrip:true
  }),
  blockers:Object.freeze(blockers),
  executionEnabled:false,
  approvalGranted:false,
  productionChangeSetApproved:false,
  buildingGraphMutated:false,
  realApsJobSubmitted:false
 });
}
