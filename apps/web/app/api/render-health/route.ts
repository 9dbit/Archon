import { NextResponse } from 'next/server';
import { checkArchonDatabaseReadiness } from '@archon/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const database = databaseUrl ? await checkArchonDatabaseReadiness(databaseUrl) : false;
  return NextResponse.json(
    { service: 'archon-render-standby', ready: database, database: database ? 'connected' : 'unavailable' },
    { status: database ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
