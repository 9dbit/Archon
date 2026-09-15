import { NextResponse } from 'next/server';
import { getApsConfig, issueApsViewerToken } from '@archon/engine-adapters';

export const dynamic = 'force-dynamic';

export async function GET() {
  const viewerEnabled = process.env.ARCHON_AUTOCAD_VIEWER_ENABLED === 'true';
  const urn = process.env.APS_VIEWER_URN?.trim();
  const translationStatus = process.env.APS_VIEWER_TRANSLATION_STATUS?.trim().toUpperCase() || 'NOT_CONFIGURED';
  if (!viewerEnabled || !urn || translationStatus !== 'SUCCESS') {
    return NextResponse.json({
      error: 'AUTOCAD_VIEWER_SESSION_LOCKED',
      state: 'LOCKED',
      diagnostics: ['DWG_VIEWER_FAIL_CLOSED', 'NO_EXTERNAL_ARTIFACT_LOADED'],
      executionEnabled: false,
      externalSync: 'LOCKED'
    }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const token = await issueApsViewerToken(getApsConfig());
    return NextResponse.json({
      state: 'READY',
      urn,
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      diagnostics: ['APS_VIEWER_TOKEN_ISSUED_FOR_READ_ONLY_REVIEW', 'ARCHON_CANONICAL_GRAPH_UNCHANGED'],
      executionEnabled: false,
      externalSync: 'LOCKED'
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'APS_VIEWER_TOKEN_FAILED';
    return NextResponse.json({ error: 'AUTOCAD_VIEWER_SESSION_FAILED', state: 'FAILED', diagnostics: [code], executionEnabled: false, externalSync: 'LOCKED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
