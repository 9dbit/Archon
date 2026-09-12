import { NextResponse } from 'next/server';
import { rebaseChangeSetProposal } from '@archon/db';
import { getDatabase } from '../../../../../lib/db';

export async function POST(request: Request, context: { params: Promise<{ changeSetId: string }> }) {
  try {
    const { changeSetId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor : 'ARCHON User';
    const changeSet = await rebaseChangeSetProposal(getDatabase(), { changeSetId, actor });
    return NextResponse.json({ ok: true, changeSet }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'DATABASE_URL_NOT_CONFIGURED'
      ? 503
      : message === 'CHANGESET_NOT_FOUND' || message === 'PROJECT_NOT_FOUND'
        ? 404
        : message === 'NO_OPERATIONS' || message === 'INVALID_MOVE_PAYLOAD' || message === 'INVALID_DIMENSION' || message.startsWith('CANONICAL_TARGET_NOT_FOUND') || message.startsWith('UNSUPPORTED_OPERATION')
          ? 400
          : message === 'PROJECT_HAS_NO_APPROVED_VERSION' || message.startsWith('CHANGESET_NOT_EDITABLE')
            ? 409
            : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
