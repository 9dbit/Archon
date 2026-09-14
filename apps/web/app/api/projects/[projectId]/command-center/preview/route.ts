import { NextResponse } from 'next/server';
import { getProjectSummary } from '@archon/db';
import { createCommandCenterPreview } from '@archon/domain';
import { getDatabase } from '../../../../../../lib/db';

const activeStates = ['DRAFT','PROPOSED','SANDBOXED','VALIDATING','NEEDS_REVIEW','APPROVED'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const body = await request.json() as { prompt?: unknown; targetArchonId?: unknown };
    const summary = await getProjectSummary(getDatabase(), projectId);
    if (!summary) return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 });
    const activeChangeSet = summary.proposedChanges.find(changeSet => activeStates.includes(changeSet.state));
    const preview = createCommandCenterPreview({
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      targetArchonId: typeof body.targetArchonId === 'string' ? body.targetArchonId : undefined,
      canonicalObjects: summary.canonicalObjects,
      currentApprovedVersionId: summary.project.currentApprovedVersionId,
      activeChangeSetId: activeChangeSet?.id
    });
    return NextResponse.json(preview, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message === 'DATABASE_URL_NOT_CONFIGURED' ? 503 : message.startsWith('COMMAND_CENTER_') ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
