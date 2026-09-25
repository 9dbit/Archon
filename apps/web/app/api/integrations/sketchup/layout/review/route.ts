import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createLayoutReviewProposal,
  createSketchUpExecutionPackageDraft
} from '@archon/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_BODY_BYTES = 64 * 1024;

function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function tokenHashMatches(expectedHash: string, receivedToken: string) {
  const normalizedExpected = expectedHash.trim().toLowerCase();
  if (!SHA256_HEX_PATTERN.test(normalizedExpected)) return false;
  const receivedHash = sha256Hex(receivedToken);
  return timingSafeEqual(Buffer.from(normalizedExpected, 'hex'), Buffer.from(receivedHash, 'hex'));
}

function unauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const expectedTokenHash = process.env.ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256?.trim();
  if (!expectedTokenHash || !SHA256_HEX_PATTERN.test(expectedTokenHash)) {
    return NextResponse.json(
      { error: 'ARCHON_SKETCHUP_BRIDGE_NOT_CONFIGURED' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const receivedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!receivedToken || !tokenHashMatches(expectedTokenHash, receivedToken)) return unauthorized();

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'LAYOUT_REVIEW_REQUEST_TOO_LARGE', maxBytes: MAX_BODY_BYTES },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: {
    prompt?: unknown;
    candidateId?: unknown;
    edits?: unknown;
    projectId?: unknown;
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const proposal = createLayoutReviewProposal({
      prompt: typeof body.prompt === 'string' ? body.prompt : '',
      candidateId: typeof body.candidateId === 'string' ? body.candidateId : '',
      edits: Array.isArray(body.edits) ? body.edits as Array<{
        roomId: string;
        xMm?: number;
        yMm?: number;
        widthMm?: number;
        depthMm?: number;
      }> : []
    });
    const projectRef = typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : null;
    const executionPackageDraft = proposal.state === 'REVIEW_READY'
      ? createSketchUpExecutionPackageDraft({ review: proposal, projectRef })
      : null;

    return NextResponse.json(
      {
        ...proposal,
        projectId: projectRef,
        executionPackageDraft,
        execution: {
          mode: 'EXECUTION_PACKAGE_DRAFT_ONLY',
          durablePackageApproved: false,
          sketchUpMutationEnabled: false,
          approveAndDrawEnabled: false,
          rubyExecutorCalled: false,
          nextGate: 'APPROVE_EXECUTION_PACKAGE'
        }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message.startsWith('EXECUTION_PACKAGE_')
      || message.startsWith('DRAWING_IR_')
      || message.startsWith('PROMPT_LAYOUT_') ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
