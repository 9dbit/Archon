import {writeFileSync} from 'node:fs';
const namespace=process.argv[2];
if(!namespace || !/^[A-Za-z0-9_-]+$/.test(namespace)) throw Error('Supply the real APS Automation namespace; this script makes no API calls.');
const bundleId='ArchonLayoutBundle', activityId='ArchonGenerateLayout', alias='v0_1';
const engine='Autodesk.AutoCAD+25_1';
const parameter=(verb,localName)=>({verb,localName,required:true,zip:false,ondemand:false});
const config={
  appBundle:{id:bundleId,engine,description:'ARCHON version-bound sandbox geometry'},
  appBundleAlias:{id:alias,version:1},
  activity:{
    id:activityId,engine,appbundles:[namespace+'.'+bundleId+'+'+alias],
    commandLine:['"$(engine.path)\\accoreconsole.exe" /i "$(args[seedDwg].path)" /al "$(appbundles['+bundleId+'].path)" /s "$(settings[script].path)"'],
    parameters:{seedDwg:parameter('get','seed.dwg'),inputJson:parameter('get','archon-input.json'),outputDwg:parameter('put','archon-output.dwg'),report:parameter('put','archon-report.json')},
    settings:{script:{value:'ARCHONLAYOUT\n'}}
  },
  activityAlias:{id:alias,version:1},
  railway:{APS_AUTOCAD_ENGINE:engine,APS_APPBUNDLE_ID:namespace+'.'+bundleId+'+'+alias,APS_ACTIVITY_ID:namespace+'.'+activityId+'+'+alias},
  executionEnabled:false
};
writeFileSync('archon-aps-resource-plan.json',JSON.stringify(config,null,2));
