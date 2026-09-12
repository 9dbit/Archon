import { NextResponse } from 'next/server';
import { getAutoCadAdapterStatus, getApsDiagnostics, getApsConnectionStatus } from '@archon/engine-adapters';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ adapter: getAutoCadAdapterStatus(), automation: getApsDiagnostics(), connection: getApsConnectionStatus(),
    timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
