// Independent Revit capability worker. This deliberately has NO WorkItem,
// Activity, AppBundle, upload, model-write, or execution code path.
import { createServer } from 'node:http';
import { discoverRevitAccess } from './discovery.mjs';
import { auditRevitResources } from './audit-resources.mjs';

const mode = process.env.ARCHON_REVIT_APS_WORKER_MODE ?? 'OFFLINE';
const exitsAfterCheck = process.env.ARCHON_REVIT_APS_WORKER_EXIT === '1';
let status = { state: 'STARTING', executionEnabled: false };

try {
  if (mode === 'OFFLINE') {
    status = { state: 'OFFLINE_READY', authVerified: false, revitAvailable: false, executionEnabled: false };
  } else if (mode === 'DISCOVER') {
    const result = await discoverRevitAccess();
    status = { ...result, executionEnabled: false };
    if (result.state !== 'VERIFIED') process.exitCode = 1;
  } else if (mode === 'AUDIT') {
    const result = await auditRevitResources();
    status = { ...result, executionEnabled: false, provisioningEnabled: false, workitemsEnabled: false };
    if (result.state !== 'VERIFIED') process.exitCode = 1;
  } else {
    status = { state: 'FAILED', diagnostics: ['REVIT_WORKER_MODE_INVALID'], executionEnabled: false };
    process.exitCode = 1;
  }
} catch {
  status = { state: 'FAILED', diagnostics: ['REVIT_WORKER_UNEXPECTED_FAILURE'], executionEnabled: false };
  process.exitCode = 1;
}

console.log('ARCHON_REVIT_WORKER_RESULT ' + JSON.stringify(status));

if (!exitsAfterCheck) {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REVIT_WORKER_PORT_INVALID');
  }
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' || (req.url !== '/status' && req.url !== '/health')) {
      res.writeHead(404); res.end('{}'); return;
    }
    const code = (req.url === '/health' && status.state === 'FAILED') ? 503 : 200;
    res.writeHead(code); res.end(JSON.stringify(status));
  });
  server.listen(port, '0.0.0.0');
  for (const signal of ['SIGTERM', 'SIGINT']) server.on('listening', () => {
    if (!server._archonSignalHandlers) {
      server._archonSignalHandlers = true;
      process.on(signal, () => server.close(() => process.exit(0)));
    }
  });
}
