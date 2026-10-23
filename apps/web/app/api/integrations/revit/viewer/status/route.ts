import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Revit viewer readiness based on dedicated, server-side configuration only. */
export function GET() {
  const viewerEnabled = process.env.ARCHON_REVIT_VIEWER_ENABLED === 'true';
  const credentialsConfigured = Boolean(process.env.ARCHON_REVIT_APS_CLIENT_ID?.trim() &&
    process.env.ARCHON_REVIT_APS_CLIENT_SECRET?.trim());
  const urnConfigured = Boolean(process.env.ARCHON_REVIT_VIEWER_URN?.trim());
  // A public viewer-token endpoint is allowed only for a dedicated synthetic-only APS app.
  // Real customer models require a future authenticated, user-scoped Viewer session.
  const syntheticDemoOnly = process.env.ARCHON_REVIT_VIEWER_ACCESS_MODE === 'PUBLIC_SYNTHETIC_PILOT';
  const translationStatus = process.env.ARCHON_REVIT_VIEWER_TRANSLATION_STATUS?.trim().toUpperCase() || 'NOT_CONFIGURED';
  const missing = [
    !syntheticDemoOnly ? 'Authenticated Revit viewer session (or isolated synthetic pilot)' : null,
    !viewerEnabled ? 'ARCHON_REVIT_VIEWER_ENABLED=true' : null,
    !credentialsConfigured ? 'Dedicated Revit APS Viewer credentials' : null,
    !urnConfigured ? 'ARCHON_REVIT_VIEWER_URN (translated RVT)' : null,
    translationStatus !== 'SUCCESS' ? 'ARCHON_REVIT_VIEWER_TRANSLATION_STATUS=SUCCESS' : null
  ].filter((value): value is string => Boolean(value));
  const state = missing.length === 0 ? 'READY' : translationStatus === 'PENDING' ? 'TRANSLATION_PENDING' : 'NOT_READY';

  return NextResponse.json({
    state, viewerEnabled, credentialsConfigured, urnConfigured, translationStatus, missing,
    accessMode: syntheticDemoOnly ? 'PUBLIC_SYNTHETIC_PILOT' : 'LOCKED_UNTIL_AUTH',
    nativeRvtOriginVerified: false, executionEnabled: false,
    diagnostics: state === 'READY'
      ? ['APS_VIEWER_CONFIGURED', 'READ_ONLY_VIEWER_SESSION_AVAILABLE']
      : ['NO_TRANSLATED_REVIT_MODEL_READY', 'VIEWER_FAIL_CLOSED']
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
