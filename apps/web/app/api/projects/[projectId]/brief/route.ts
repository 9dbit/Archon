import { NextResponse } from 'next/server';
import { getProjectBrief } from '@archon/db';
import { getDatabase } from '../../../../../lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const brief = await getProjectBrief(getDatabase(), projectId);
    return NextResponse.json({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'DATABASE_URL_NOT_CONFIGURED' ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
