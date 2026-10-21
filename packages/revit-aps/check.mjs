// Explicit read-only CLI. This is not imported by the ARCHON web server or APS worker.
import { discoverRevitAccess } from './discovery.mjs';

const result = await discoverRevitAccess();
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
process.exitCode = result.state === 'VERIFIED' ? 0 : result.state === 'NOT_CONFIGURED' ? 2 : 1;
