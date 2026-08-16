/**
 * Contract-mandated integration tests (docs/05 §12) against the real database.
 * DB tests are never skipped: missing DATABASE_URL fails the suite loudly.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { BriefInput, RuleInput } from "@workspace/domain";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for integration tests — DB tests must never be silently skipped.",
  );
}

let app: Express;
let pool: { end: () => Promise<void> };

const goodBrief: BriefInput = {
  siteWidthMm: 20000,
  siteDepthMm: 30000,
  levels: 2,
  floorToFloorHeightsMm: [3500, 3200],
  circulation: { minCorridorWidthMm: 1200 },
  doorStandards: { widthMm: 900, heightMm: 2100 },
  windowStandards: { sillMm: 900, headMm: 2400 },
  lengthUnit: "mm",
};

const circulationRule: RuleInput = {
  code: "CIRC-MIN-WIDTH",
  category: "circulation",
  description: "Corridors must be at least 1000 mm wide",
  subject: "corridorWidthMm",
  operator: ">=",
  expectedValue: 1000,
  unit: "mm",
  sourceType: "REGULATION",
  sourceReference: "Local building code §4.2",
  severity: "BLOCKER",
  active: true,
};

beforeAll(async () => {
  const { createApp } = await import("../src/app");
  const dbModule = await import("@workspace/db");
  app = createApp();
  pool = dbModule.pool;
});

afterAll(async () => {
  await pool.end();
});

async function createProject(name: string): Promise<string> {
  const res = await request(app)
    .post("/api/projects")
    .send({ name, buildingType: "restaurant", actor: "test" });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function propose(
  projectId: string,
  operations: unknown[],
  intentSummary = "test changeset",
): Promise<string> {
  const res = await request(app)
    .post(`/api/projects/${projectId}/change-sets`)
    .send({
      intentSummary,
      operations,
      affectedDomains: ["geometry", "rules"],
      createdBy: "test",
    });
  expect(res.status).toBe(201);
  expect(res.body.state).toBe("PROPOSED");
  return res.body.id as string;
}

describe("ARCHON Phase 0 API", () => {
  // 1. Project creation
  it("creates a project and lists it", async () => {
    const id = await createProject(`T1 ${Date.now()}`);
    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.project.id).toBe(id);
    expect(detail.body.approved.versionNumber).toBe(0);
  });

  // 2. Brief interpretation is deterministic and does not persist
  it("interprets a brief deterministically without persisting", async () => {
    const id = await createProject(`T2 ${Date.now()}`);
    const text =
      "Restaurant on a 20m x 30m site, 2 storeys, floor to floor 3.5m, corridors min 1.2m, with dining and kitchen";
    const a = await request(app)
      .post(`/api/projects/${id}/interpret-brief`)
      .send({ text });
    const b = await request(app)
      .post(`/api/projects/${id}/interpret-brief`)
      .send({ text });
    expect(a.status).toBe(200);
    expect(a.body.providerId).toBe("deterministic-mock-v1");
    expect(a.body.persisted).toBe(false);
    expect(a.body.brief).toEqual(b.body.brief);
    expect(a.body.brief.siteWidthMm).toBe(20000);
    expect(a.body.brief.circulation.minCorridorWidthMm).toBe(1200);
    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.body.brief).toBeNull();
  });

  // 3. Proposing a ChangeSet never touches authoritative state
  it("keeps authoritative state untouched while a ChangeSet is only proposed", async () => {
    const id = await createProject(`T3 ${Date.now()}`);
    await propose(id, [{ type: "UPSERT_BRIEF", brief: goodBrief }]);
    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.body.brief).toBeNull();
    expect(detail.body.rules).toEqual([]);
    expect(detail.body.approved.versionNumber).toBe(0);
  });

  // 4. Validation produces provenance-carrying checks; clean pass -> NEEDS_REVIEW
  it("validates a clean ChangeSet into NEEDS_REVIEW with evidence-bearing checks", async () => {
    const id = await createProject(`T4 ${Date.now()}`);
    const cs = await propose(id, [
      { type: "UPSERT_BRIEF", brief: goodBrief },
      { type: "UPSERT_RULE", rule: circulationRule },
    ]);
    const res = await request(app)
      .post(`/api/change-sets/${cs}/validate`)
      .send({ actor: "test" });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe("NEEDS_REVIEW");
    expect(res.body.checks.length).toBeGreaterThan(0);
    for (const check of res.body.checks) {
      expect(check.sourceType).toBeTruthy();
      expect(check.evidence.length).toBeGreaterThan(0);
    }
  });

  // 5. Blocking validation failure prevents approval
  it("routes blocking violations to VALIDATION_FAILED and refuses approval", async () => {
    const id = await createProject(`T5 ${Date.now()}`);
    const badBrief = { ...goodBrief, circulation: { minCorridorWidthMm: 800 } };
    const cs = await propose(id, [
      { type: "UPSERT_BRIEF", brief: badBrief },
      { type: "UPSERT_RULE", rule: circulationRule },
    ]);
    const v = await request(app)
      .post(`/api/change-sets/${cs}/validate`)
      .send({});
    expect(v.body.state).toBe("VALIDATION_FAILED");
    const approve = await request(app)
      .post(`/api/change-sets/${cs}/approve`)
      .send({});
    expect(approve.status).toBe(409);
    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.body.approved.versionNumber).toBe(0);
  });

  // 6. Approve + commit is transactional, versioned, audited, idempotent
  it("commits an approved ChangeSet into an immutable version, idempotently", async () => {
    const id = await createProject(`T6 ${Date.now()}`);
    const cs = await propose(id, [
      { type: "UPSERT_BRIEF", brief: goodBrief },
      { type: "UPSERT_RULE", rule: circulationRule },
    ]);
    await request(app).post(`/api/change-sets/${cs}/validate`).send({});
    const approve = await request(app)
      .post(`/api/change-sets/${cs}/approve`)
      .send({ reviewer: "test-reviewer" });
    expect(approve.status).toBe(200);
    expect(approve.body.changeSet.state).toBe("COMMITTED");
    const versionId = approve.body.version.id;
    expect(approve.body.version.versionNumber).toBe(1);

    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.body.project.currentApprovedVersionId).toBe(versionId);
    expect(detail.body.brief.brief.siteWidthMm).toBe(20000);
    expect(detail.body.rules).toHaveLength(1);

    // Idempotent re-approval/commit does not create a second version.
    const again = await request(app)
      .post(`/api/change-sets/${cs}/approve`)
      .send({});
    expect(again.status).toBe(409); // COMMITTED cannot be re-approved
    const versions = await request(app).get(`/api/projects/${id}/versions`);
    expect(versions.body).toHaveLength(1);

    const audit = await request(app).get(`/api/projects/${id}/audit-events`);
    const events = audit.body.map((e: { eventType: string }) => e.eventType);
    expect(events).toContain("CHANGE_SET_PROPOSED");
    expect(events).toContain("CHANGE_SET_VALIDATED");
    expect(events).toContain("CHANGE_SET_APPROVED");
    expect(events).toContain("VERSION_COMMITTED");
  });

  // 7. Illegal state transitions are rejected
  it("rejects illegal state transitions via the API", async () => {
    const id = await createProject(`T7 ${Date.now()}`);
    const cs = await propose(id, [{ type: "UPSERT_BRIEF", brief: goodBrief }]);
    // approve without validation (PROPOSED -> APPROVED is illegal)
    const approve = await request(app)
      .post(`/api/change-sets/${cs}/approve`)
      .send({});
    expect(approve.status).toBe(409);
    // reject, then attempt to edit a terminal ChangeSet
    const reject = await request(app)
      .post(`/api/change-sets/${cs}/reject`)
      .send({});
    expect(reject.status).toBe(200);
    expect(reject.body.state).toBe("REJECTED");
    const patch = await request(app)
      .patch(`/api/change-sets/${cs}`)
      .send({ operations: [{ type: "UPSERT_BRIEF", brief: goodBrief }] });
    expect(patch.status).toBe(409);
  });

  // 8. Canvas artifacts are non-authoritative; promotion only proposes
  it("keeps canvas artifacts non-authoritative and promotion only creates a Proposed ChangeSet", async () => {
    const id = await createProject(`T8 ${Date.now()}`);
    const created = await request(app)
      .post(`/api/projects/${id}/canvas-artifacts`)
      .send({
        artifact: {
          artifactType: "concept-sketch",
          title: "Alt A",
          status: "ACTIVE",
          parentArtifactIds: [],
          sourceType: "USER_INPUT",
          metadata: {},
        },
        actor: "test",
      });
    expect(created.status).toBe(201);
    expect(created.body.authoritative).toBe(false);

    const promoted = await request(app)
      .post(`/api/canvas-artifacts/${created.body.id}/promote`)
      .send({
        operations: [{ type: "UPSERT_BRIEF", brief: goodBrief }],
        actor: "test",
      });
    expect(promoted.status).toBe(201);
    expect(promoted.body.changeSet.state).toBe("PROPOSED");
    expect(promoted.body.changeSet.source).toBe("CANVAS_PROMOTION");
    expect(promoted.body.artifact.promotionStatus).toBe("PROMOTION_PROPOSED");
    expect(promoted.body.artifact.authoritative).toBe(false);

    // Authoritative state untouched by promotion.
    const detail = await request(app).get(`/api/projects/${id}`);
    expect(detail.body.brief).toBeNull();
    expect(detail.body.approved.versionNumber).toBe(0);
  });

  // 9. Adapter failure mode never corrupts canonical state
  it("returns a controlled adapter failure that leaves canonical state intact", async () => {
    const id = await createProject(`T9 ${Date.now()}`);
    const cs = await propose(id, [{ type: "UPSERT_BRIEF", brief: goodBrief }]);
    await request(app).post(`/api/change-sets/${cs}/validate`).send({});
    await request(app).post(`/api/change-sets/${cs}/approve`).send({});

    const adapters = await request(app).get("/api/adapters");
    expect(adapters.status).toBe(200);
    expect(adapters.body.length).toBeGreaterThanOrEqual(3);
    const adapterId = adapters.body[0].id;

    const before = await request(app).get(`/api/projects/${id}`);
    const failure = await request(app)
      .post(`/api/adapters/${adapterId}/simulate`)
      .send({ projectId: id, mode: "failure" });
    expect(failure.status).toBe(502);
    expect(failure.body.result.ok).toBe(false);
    expect(failure.body.result.error).toContain("Canonical state untouched");

    const after = await request(app).get(`/api/projects/${id}`);
    expect(after.body.brief).toEqual(before.body.brief);
    expect(after.body.approved).toEqual(before.body.approved);

    const ok = await request(app)
      .post(`/api/adapters/${adapterId}/simulate`)
      .send({ projectId: id, mode: "sync" });
    expect(ok.status).toBe(200);
    expect(ok.body.result.ok).toBe(true);
  });
});
