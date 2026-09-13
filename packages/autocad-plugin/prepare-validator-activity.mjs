export function createValidatorActivityPlan(namespace){
 if(typeof namespace!=='string'||!/^[A-Za-z0-9_-]+$/.test(namespace))throw Error('SANDBOX_VALIDATOR_NAMESPACE_INVALID');
 const alias='v0_1',engine='Autodesk.AutoCAD+25_1',bundle='ArchonLayoutBundle',activity='ArchonValidateDrawing';
 const parameter=(verb,localName)=>({verb,localName,required:true,zip:false,ondemand:false});
 return Object.freeze({namespace,engine,activity,alias,activityId:namespace+'.'+activity+'+'+alias,appbundles:[namespace+'.'+bundle+'+'+alias],
  commandLine:['"$(engine.path)\\accoreconsole.exe" /i "$(args[inputDwg].path)" /al "$(appbundles['+bundle+'].path)" /s "$(settings[script].path)"'],
  parameters:{inputDwg:parameter('get','archon-output.dwg'),reopenReport:parameter('put','archon-reopen-report.json')},settings:{script:{value:'ARCHONVALIDATE\n'}},
  executionEnabled:false,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'});
}
