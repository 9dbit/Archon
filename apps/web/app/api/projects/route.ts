import { NextResponse } from 'next/server';
import { listProjects } from '@archon/db';
import { getDatabase } from '../../lib/db';

export async function GET() {
  try {
    const projects = await listProjects(getDatabase());
    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'DATABASE_URL_NOT_CONFIGURED' ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
