import { NextResponse } from 'next/server';
import { issueApsViewerToken } from '@archon/engine-adapters';

export const dynamic = 'force-dynamic';

/**
 * Viewer-only short-lived token for a pre-translated RVT URN.
 * Never return the client ID, secret, or a broad automation-scoped token.
 */
export async function GET() {
  const enabled = process.env.ARCHON_REVIT_VIEWER_ENABLED === 'true';
  // Fail closed for real project data: this app has no authenticated Revit user sessions yet.
  // PUBLIC_SYNTHETIC_PILOT must ONLY use a separate APS app with non-sensitive pilot assets.
  const syntheticDemoOnly = process.env.ARCHON_REVIT_VIEWER_ACCESS_MODE === 'PUBLIC_SYNTHETIC_PILOT';
  const urn = process.env.ARCHON_REVIT_VIEWER_URN?.trim();
  const translated = process.env.ARCHON_REVIT_VIEWER_TRANSLATION_STATUS?.trim().toUpperCase() === 'SUCCESS';
  const clientId = process.env.ARCHON_REVIT_APS_CLIENT_ID?.trim();
  const clientSecret = process.env.ARCHON_REVIT_APS_CLIENT_SECRET?.trim();

  if (!syntheticDemoOnly || !enabled || !translated || !urn || !clientId || !clientSecret) {
    return NextResponse.json({
      state: 'LOCKED', error: 'REVIT_VIEWER_NOT_READY', executionEnabled: false
    }, { status: 403, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  try {
    const token = await issueApsViewerToken({ clientId, clientSecret });
    return NextResponse.json({
      state: 'READY', urn, accessToken: token.accessToken, expiresIn: token.expiresIn,
      executionEnabled: false, externalSync: 'READ_ONLY_VIEWER'
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({
      state: 'FAILED', error: 'REVIT_VIEWER_TOKEN_UNAVAILABLE', executionEnabled: false
    }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
