import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MANIFEST_SCHEMA = 'archon.sketchup.manifest.v1';
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

function unauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function tokenHashMatches(expectedHash: string, receivedToken: string) {
  const normalizedExpected = expectedHash.trim().toLowerCase();
  if (!SHA256_HEX_PATTERN.test(normalizedExpected)) return false;

  const receivedHash = sha256Hex(receivedToken);
  return timingSafeEqual(
    Buffer.from(normalizedExpected, 'hex'),
    Buffer.from(receivedHash, 'hex')
  );
}

export async function POST(request: NextRequest) {
  const expectedTokenHash =
    process.env.ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256?.trim();

  if (!expectedTokenHash || !SHA256_HEX_PATTERN.test(expectedTokenHash)) {
    return NextResponse.json(
      { error: 'ARCHON_SKETCHUP_BRIDGE_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const receivedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!receivedToken || !tokenHashMatches(expectedTokenHash, receivedToken)) {
    return unauthorized();
  }

  const rawBody = await request.text();
  const bodyBytes = Buffer.byteLength(rawBody, 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'MANIFEST_TOO_LARGE', maxBytes: MAX_BODY_BYTES },
      { status: 413 }
    );
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (manifest.schema !== MANIFEST_SCHEMA) {
    return NextResponse.json(
      { error: 'UNSUPPORTED_MANIFEST_SCHEMA', expected: MANIFEST_SCHEMA },
      { status: 422 }
    );
  }

  const model = manifest.model as Record<string, unknown> | undefined;
  const summary = manifest.summary as Record<string, unknown> | undefined;
  if (!model?.guid || !summary) {
    return NextResponse.json(
      { error: 'INVALID_MANIFEST', required: ['model.guid', 'summary'] },
      { status: 422 }
    );
  }

  const payloadSha256 = sha256Hex(rawBody);
  const receiptId = randomUUID();

  // First v2 slice is intentionally read-only: acceptance does not create,
  // approve, execute, or commit a ChangeSet and does not mutate SketchUp state.
  return NextResponse.json({
    accepted: true,
    receiptId,
    payloadSha256,
    semanticHash:
      typeof manifest.semantic_hash === 'string' ? manifest.semantic_hash : null,
    modelGuid: model.guid,
    projectId:
      typeof manifest.project_id === 'string' && manifest.project_id.length > 0
        ? manifest.project_id
        : null,
    receivedAt: new Date().toISOString(),
    mutation: 'none'
  });
}
