import { NextResponse } from 'next/server';
import { getAutoCadAdapterStatus, getApsDiagnostics } from '@archon/engine-adapters';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ adapter: getAutoCadAdapterStatus(), automation: getApsDiagnostics(),
    timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
