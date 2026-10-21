// Unapplied local-only generator Activity plan. Never calls Autodesk.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = 'Autodesk.Revit+2026';
const APPBUNDLE = 'ArchonRevitGeneratePilot';
const ACTIVITY = 'ArchonRevitGenerateModel';
const ALIAS = 'pilot_v1';

export function prepareNativeGeneratorPlan(namespace, discovery) {
  if(typeof namespace !== 'string' || !/^[A-Za-z0-9_]{1,20}$/.test(namespace))
    throw new Error('REVIT_GENERATOR_NAMESPACE_INVALID');
  if(discovery?.state !== 'VERIFIED' || discovery.authVerified !== true ||
     discovery.automationApiVerified !== true ||
     discovery.executionEnabled !== false ||
     !Array.isArray(discovery.revitEngines) || !discovery.revitEngines.includes(ENGINE))
    throw new Error('REVIT_GENERATOR_ENGINE_NOT_VERIFIED');
  const param = (verb, localName) => ({
    verb, localName, required: true, zip: false, ondemand: false
  });
  return {
    schemaVersion: 1,
    purpose: 'UNAPPLIED_OFFLINE_GENERATOR_DRAFT',
    engine: ENGINE,
    appBundle: {
      id: APPBUNDLE,
      engine: ENGINE,
      description: 'ARCHON fixed-dimension four-wall native sandbox generator'
    },
    appBundleAlias: {id: ALIAS, version: 1},
    activity: {
      id: ACTIVITY,
      engine: ENGINE,
      description: 'Create a new metric Revit project and four native walls without an input RVT',
      appbundles: [namespace + '.' + APPBUNDLE + '+' + ALIAS],
      commandLine: [
        '"$(engine.path)\\revitcoreconsole.exe" /al "$(appbundles[' + APPBUNDLE + '].path)"'
      ],
      parameters: {
        geometry: param('get', 'archon-pilot-input.json'),
        outputRvt: param('put', 'pilot.rvt'),
        report: param('put', 'pilot-report.json')
      },
      settings: {}
    },
    activityAlias: {id: ALIAS, version: 1},
    workitemRetries: 0,
    maxConcurrentWorkItems: 1,
    provisioningEnabled: false,
    executionEnabled: false,
    customerModelAccessEnabled: false,
    approvedForProduction: false
  };
}

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  if(process.argv.length !== 4)
    throw new Error('Usage: prepare-generator-plan.mjs <APS_NAMESPACE> <SANITIZED_DISCOVERY_JSON>');
  const input = readFileSync(process.argv[3]);
  if(input.length > 100 * 1024) throw new Error('REVIT_GENERATOR_DISCOVERY_TOO_LARGE');
  const plan = prepareNativeGeneratorPlan(process.argv[2], JSON.parse(input.toString('utf8')));
  const outfile = resolve('archon-revit-generator-unapplied-plan.json');
  writeFileSync(outfile, JSON.stringify(plan,null,2) + '\n', {
    flag: 'wx', mode: 0o600, encoding: 'utf8'
  });
  console.log('REVIT_NATIVE_GENERATOR_UNAPPLIED_PLAN_WRITTEN '+outfile);
}
