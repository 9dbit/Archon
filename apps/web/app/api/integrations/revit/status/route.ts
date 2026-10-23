import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Configuration inventory only. This endpoint does not authenticate with
 * Autodesk and MUST NOT advertise successful native Revit execution.
 */
export function GET() {
  const credentialsConfigured = Boolean(process.env.ARCHON_REVIT_APS_CLIENT_ID?.trim() &&
    process.env.ARCHON_REVIT_APS_CLIENT_SECRET?.trim());
  const appBundleConfigured = Boolean(process.env.ARCHON_REVIT_APPBUNDLE_ID?.trim());
  const activityConfigured = Boolean(process.env.ARCHON_REVIT_ACTIVITY_ID?.trim());

  return NextResponse.json({
    state: credentialsConfigured ? 'CREDENTIALS_CONFIGURED_NOT_VERIFIED' : 'NOT_CONFIGURED',
    credentialsConfigured,
    appBundleConfigured,
    activityConfigured,
    nativeWorkItemVerified: false,
    pilotRvtVerified: false,
    executionEnabled: false,
    diagnostics: [
      credentialsConfigured ? 'REVIT_CREDENTIALS_PRESENT_NOT_AUTHENTICATED' : 'REVIT_DEDICATED_CREDENTIALS_NOT_CONFIGURED',
      'REVIT_NATIVE_WORKITEM_NOT_VERIFIED',
      'NO_REVIT_MODEL_GENERATED_BY_THIS_ENDPOINT'
    ]
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
