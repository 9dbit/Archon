// This CLI never mutates Autodesk resources. Provider credentials are ephemeral.
import { auditRevitResources } from './audit-resources.mjs';
const result = await auditRevitResources();
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.state === 'VERIFIED' ? 0 :
  result.state === 'NOT_CONFIGURED' ? 2 : 1;
