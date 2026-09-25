import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSketchUpExecutorRollbackRehearsalPlan } from '@archon/domain';
import { getApprovedSketchUpExecutionPackage } from '@archon/db';
import { getDatabase } from '../../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{8,64}$/i;
const MAX_BODY_BYTES = 8 * 1024;

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
      { error: 'SKETCHUP_EXECUTOR_REHEARSAL_REQUEST_TOO_LARGE', maxBytes: MAX_BODY_BYTES },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let body: { packageHash?: unknown; dryRunPlanFingerprint?: unknown };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const packageHash = typeof body.packageHash === 'string' ? body.packageHash.trim().toLowerCase() : '';
  if (!SHA256_HEX_PATTERN.test(packageHash)) {
    return NextResponse.json(
      { error: 'SKETCHUP_EXECUTOR_PACKAGE_HASH_INVALID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const dryRunPlanFingerprint = typeof body.dryRunPlanFingerprint === 'string'
    ? body.dryRunPlanFingerprint.trim().toLowerCase()
    : '';
  if (!FINGERPRINT_PATTERN.test(dryRunPlanFingerprint)) {
    return NextResponse.json(
      { error: 'SKETCHUP_EXECUTOR_DRY_RUN_FINGERPRINT_INVALID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const record = await getApprovedSketchUpExecutionPackage(getDatabase(), packageHash);
    if (!record) {
      return NextResponse.json(
        { error: 'SKETCHUP_EXECUTOR_PACKAGE_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (!record.approval) {
      return NextResponse.json(
        { error: 'SKETCHUP_EXECUTOR_PACKAGE_APPROVAL_MISSING' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const plan = createSketchUpExecutorRollbackRehearsalPlan({
      packageHash: record.package.packageHash,
      packageState: record.package.state,
      executionEnabled: record.package.executionEnabled,
      approvalReference: record.approval.id,
      approvalDecision: record.approval.decision,
      payload: record.package.payload
    });

    if (plan.source.dryRunPlanFingerprint.toLowerCase() !== dryRunPlanFingerprint) {
      return NextResponse.json(
        {
          error: 'SKETCHUP_EXECUTOR_DRY_RUN_FINGERPRINT_MISMATCH',
          expected: plan.source.dryRunPlanFingerprint
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        plan,
        execution: {
          mode: 'ROLLBACK_REHEARSAL_ONLY',
          packageState: record.package.state,
          dryRunPlanFingerprintBound: true,
          sketchUpMutationEnabled: false,
          transactionAllowed: true,
          transientGeometryAllowed: true,
          persistentGeometryAllowed: false,
          abortRequired: true,
          commitAllowed: false,
          saveAllowed: false,
          nextGate: 'APPROVE_SKETCHUP_EXECUTOR'
        }
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message.startsWith('SKETCHUP_EXECUTOR_') ? 409 : 500;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
