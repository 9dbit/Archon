import { NextResponse } from 'next/server';
import { approveChangeSet } from '@archon/db';
import { getDatabase } from '../../../../../lib/db';

export async function POST(request: Request,context: { params: Promise<{ changeSetId: string }> }) {
  try {
    const { changeSetId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reviewer = typeof body.reviewer === 'string' && body.reviewer.trim() ? body.reviewer : 'ARCHON User';
    const note = typeof body.note === 'string' ? body.note : undefined;
    const version = await approveChangeSet(getDatabase(), { changeSetId, reviewer, note });
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const conflict = message.startsWith('CHANGESET_NOT_APPROVABLE') || message === 'VALIDATION_BLOCKS_APPROVAL' || message === 'CHANGESET_BASE_VERSION_STALE';
    const status = message === 'DATABASE_URL_NOT_CONFIGURED' ? 503 : message === 'CHANGESET_NOT_FOUND' ? 404 : conflict ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
