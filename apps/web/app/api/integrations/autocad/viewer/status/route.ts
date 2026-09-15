import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const viewerEnabled = process.env.ARCHON_AUTOCAD_VIEWER_ENABLED === 'true';
  const urn = process.env.APS_VIEWER_URN?.trim();
  const translationStatus = process.env.APS_VIEWER_TRANSLATION_STATUS?.trim().toUpperCase() || 'NOT_CONFIGURED';
  const missing = [
    !viewerEnabled ? 'ARCHON_AUTOCAD_VIEWER_ENABLED' : null,
    !urn ? 'APS_VIEWER_URN' : null,
    translationStatus !== 'SUCCESS' ? 'APS_VIEWER_TRANSLATION_STATUS=SUCCESS' : null
  ].filter((value): value is string => Boolean(value));
  const state = missing.length ? (translationStatus === 'PENDING' ? 'TRANSLATION_PENDING' : 'LOCKED') : 'READY';
  return NextResponse.json({
    state,
    viewerEnabled,
    urnConfigured: Boolean(urn),
    translationStatus,
    missing,
    diagnostics: state === 'READY'
      ? ['APS_VIEWER_RESOURCE_READY', 'READ_ONLY_ARCHON_CANONICAL_OVERLAY', 'VIEWER_SESSION_TRANSPORT_PENDING']
      : ['DWG_VIEWER_FAIL_CLOSED', 'NO_EXTERNAL_ARTIFACT_LOADED'],
    executionEnabled: false,
    externalSync: 'LOCKED'
  }, { headers: { 'Cache-Control': 'no-store' } });
}
