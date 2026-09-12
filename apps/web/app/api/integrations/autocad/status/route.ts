import { NextResponse } from 'next/server';
import { getAutoCadAdapterStatus } from '@archon/engine-adapters';

export function GET() {
  return NextResponse.json({
    adapter: getAutoCadAdapterStatus(),
    timestamp: new Date().toISOString()
  });
}
