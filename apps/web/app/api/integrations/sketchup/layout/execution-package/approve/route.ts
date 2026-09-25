import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  canonicalizeExecutionPackage,
  createLayoutReviewProposal,
  createSketchUpExecutionPackageDraft
} from '@archon/domain';
import { approveSketchUpExecutionPackage } from '@archon/db';
import { getDatabase } from '../../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_BODY_BYTES = 96 * 1024;
const CONFIRMATION = 'APPROVE_EXECUTION_PACKAGE';

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

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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
      { error: 'EXECUTION_PACKAGE_APPROVAL_REQUEST_TOO_LARGE', maxBytes: MAX_BODY_BYTES },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: {
    prompt?: unknown;
    candidateId?: unknown;
    edits?: unknown;
    projectRef?: unknown;
    expectedDrawingIrFingerprint?: unknown;
    expectedProposedChangeSetId?: unknown;
    approvedBy?: unknown;
    note?: unknown;
    confirmation?: unknown;
  };

  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (text(body.confirmation) !== CONFIRMATION) {
    return NextResponse.json(
      { error: 'EXECUTION_PACKAGE_EXPLICIT_CONFIRMATION_REQUIRED', expected: CONFIRMATION },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const expectedDrawingIrFingerprint = text(body.expectedDrawingIrFingerprint);
  const expectedProposedChangeSetId = text(body.expectedProposedChangeSetId);
  const approvedBy = text(body.approvedBy);
  if (!expectedDrawingIrFingerprint || !expectedProposedChangeSetId || !approvedBy) {
    return NextResponse.json(
      { error: 'EXECUTION_PACKAGE_APPROVAL_BINDING_REQUIRED' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const review = createLayoutReviewProposal({
      prompt: text(body.prompt),
      candidateId: text(body.candidateId),
      edits: Array.isArray(body.edits) ? body.edits as Array<{
        roomId: string;
        xMm?: number;
        yMm?: number;
        widthMm?: number;
        depthMm?: number;
      }> : []
    });

    if (review.state !== 'REVIEW_READY') {
      return NextResponse.json(
        { error: 'EXECUTION_PACKAGE_REVIEW_NOT_READY', reviewState: review.state },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (review.drawingIR.deterministicFingerprint !== expectedDrawingIrFingerprint) {
      return NextResponse.json(
        {
          error: 'EXECUTION_PACKAGE_REVIEW_CHANGED',
          binding: 'DRAWING_IR_FINGERPRINT',
          expected: expectedDrawingIrFingerprint,
          actual: review.drawingIR.deterministicFingerprint
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (review.proposedChangeSet.id !== expectedProposedChangeSetId) {
      return NextResponse.json(
        {
          error: 'EXECUTION_PACKAGE_REVIEW_CHANGED',
          binding: 'PROPOSED_CHANGESET_ID',
          expected: expectedProposedChangeSetId,
          actual: review.proposedChangeSet.id
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const draft = createSketchUpExecutionPackageDraft({
      review,
      projectRef: text(body.projectRef) || null
    });
    const packageHash = sha256Hex(canonicalizeExecutionPackage(draft));

    const persisted = await approveSketchUpExecutionPackage(getDatabase(), {
      packageHash,
      draftFingerprint: draft.draftFingerprint,
      projectRef: draft.projectRef,
      proposedChangeSetId: draft.source.proposedChangeSetId,
      drawingIrFingerprint: draft.source.drawingIrFingerprint,
      payload: draft as unknown as Record<string, unknown>,
      approvedBy,
      note: text(body.note) || null,
      expectedDrawingIrFingerprint,
      expectedProposedChangeSetId
    });

    return NextResponse.json(
      {
        accepted: true,
        schema: draft.schema,
        packageId: persisted.package.id,
        packageHash: persisted.package.packageHash,
        state: persisted.package.state,
        approvedAt: persisted.approval.createdAt,
        approvedBy: persisted.approval.approvedBy,
        idempotent: persisted.idempotent,
        source: draft.source,
        operationCount: draft.operationCount,
        safety: draft.safety,
        execution: {
          mode: 'APPROVED_EXECUTION_PACKAGE_LOCKED',
          executionEnabled: false,
          sketchUpMutationEnabled: false,
          rubyExecutorCalled: false,
          nextGate: 'APPROVE_SKETCHUP_EXECUTOR'
        }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const expectedClientError = message.startsWith('EXECUTION_PACKAGE_')
      || message.startsWith('DRAWING_IR_')
      || message.startsWith('PROMPT_LAYOUT_');
    return NextResponse.json(
      { error: message },
      { status: expectedClientError ? 400 : 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
