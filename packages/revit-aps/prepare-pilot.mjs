// No API calls: creates a local-only draft configuration from sanitized discovery.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const TARGET_ENGINE = 'Autodesk.Revit+2026';
const BUNDLE = 'ArchonRevitReadOnlyPilot';
const ACTIVITY = 'ArchonRevitInspectModel';
const ALIAS = 'pilot_v1';

export function prepareRevitPilotPlan(namespace, discovery) {
  if (typeof namespace !== 'string' || !/^[A-Za-z0-9_]{1,20}$/.test(namespace)) {
    throw new Error('REVIT_NAMESPACE_INVALID');
  }
  if (discovery?.state !== 'VERIFIED' || discovery.authVerified !== true ||
      discovery.automationApiVerified !== true || discovery.executionEnabled !== false ||
      !Array.isArray(discovery.revitEngines) || !discovery.revitEngines.includes(TARGET_ENGINE)) {
    throw new Error('REVIT_ENGINE_NOT_VERIFIED');
  }
  const parameter = (verb, localName) => ({ verb, localName, required: true, zip: false, ondemand: false });
  return {
    schemaVersion: 1,
    purpose: 'UNAPPLIED_OFFLINE_REVIEW_ONLY',
    engine: TARGET_ENGINE,
    appBundle: { id: BUNDLE, engine: TARGET_ENGINE, description: 'ARCHON Revit metadata-only pilot' },
    appBundleAlias: { id: ALIAS, version: 1 },
    activity: {
      id: ACTIVITY,
      engine: TARGET_ENGINE,
      description: 'Metadata-only Revit model inspection',
      appbundles: [namespace + '.' + BUNDLE + '+' + ALIAS],
      commandLine: [
        '"$(engine.path)\\revitcoreconsole.exe" /i "$(args[inputRvt].path)" /al "$(appbundles[' + BUNDLE + '].path)"'
      ],
      parameters: {
        inputRvt: parameter('get', 'input.rvt'),
        report: parameter('put', 'archon-revit-report.json')
      },
      settings: {}
    },
    activityAlias: { id: ALIAS, version: 1 },
    executionEnabled: false,
    provisioningEnabled: false,
    customerModelAccessEnabled: false
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: prepare-pilot.mjs <APS_NAMESPACE> <SANITIZED_DISCOVERY_JSON_PATH>');
  const source = process.argv[3];
  const buffer = readFileSync(source);
  if (buffer.length > 100 * 1024) throw new Error('REVIT_DISCOVERY_INPUT_LIMIT');
  const input = JSON.parse(buffer.toString('utf8'));
  const plan = prepareRevitPilotPlan(process.argv[2], input);
  const outputPath = resolve('archon-revit-resource-plan.json');
  writeFileSync(outputPath, JSON.stringify(plan, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log('REVIT_UNAPPLIED_PLAN_WRITTEN ' + outputPath);
}
