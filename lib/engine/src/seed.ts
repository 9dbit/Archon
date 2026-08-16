/**
 * Restaurant Demo seed (docs/05 §13):
 * - brief + several project rules committed through the real ChangeSet pipeline
 * - approved version v1
 * - a pending ChangeSet with validation warnings
 * - one non-authoritative CanvasArtifact alternative
 */
import { sql } from "drizzle-orm";
import {
  approveChangeSet,
  createCanvasArtifact,
  createProject,
  proposeChangeSet,
  validateChangeSet,
} from "./index";
import type { BriefInput, RuleInput } from "@workspace/domain";
import { db, pool, projects } from "@workspace/db";

const ACTOR = "seed-script";

const brief: BriefInput = {
  siteWidthMm: 20000,
  siteDepthMm: 30000,
  siteAreaSqm: 600,
  levels: 2,
  floorToFloorHeightsMm: [3800, 3400],
  targetGfaSqm: 450,
  programRequirements: [
    { name: "Dining area", areaSqm: 180 },
    { name: "Kitchen", areaSqm: 80 },
    { name: "Bar", areaSqm: 40 },
    { name: "Restrooms", areaSqm: 30 },
    { name: "Storage", areaSqm: 25 },
  ],
  setbacks: { frontMm: 3000, rearMm: 2000, sideMm: 1500 },
  circulation: { minCorridorWidthMm: 1200 },
  doorStandards: { widthMm: 900, heightMm: 2100 },
  windowStandards: { sillMm: 900, headMm: 2400 },
  lengthUnit: "mm",
  notes:
    "Two-storey neighbourhood restaurant. Ground floor dining + kitchen, first floor private dining and office.",
};

const rules: RuleInput[] = [
  {
    code: "CIRC-MIN-WIDTH",
    category: "circulation",
    description: "Public corridors must be at least 1000 mm wide",
    subject: "corridorWidthMm",
    operator: ">=",
    expectedValue: 1000,
    unit: "mm",
    sourceType: "REGULATION",
    sourceReference: "Local building code §4.2",
    severity: "BLOCKER",
    active: true,
  },
  {
    code: "DOOR-MIN-WIDTH",
    category: "openings",
    description: "Doors on escape routes must be at least 850 mm wide",
    subject: "doorWidthMm",
    operator: ">=",
    expectedValue: 850,
    unit: "mm",
    sourceType: "REGULATION",
    sourceReference: "Fire safety standard FS-12 §7.1",
    severity: "BLOCKER",
    active: true,
  },
  {
    code: "F2F-COMFORT",
    category: "geometry",
    description:
      "Floor-to-floor height should be at least 3200 mm for restaurant use",
    subject: "floorToFloorMm",
    operator: ">=",
    expectedValue: 3200,
    unit: "mm",
    sourceType: "STANDARD",
    sourceReference: "Practice standard HOSP-D1",
    severity: "WARNING",
    active: true,
  },
];

async function main() {
  const [existing] = await db
    .select()
    .from(projects)
    .where(sql`${projects.name} = 'Restaurant Demo'`);
  if (existing) {
    console.log("Restaurant Demo already seeded; skipping.");
    await pool.end();
    return;
  }

  const project = await createProject({
    name: "Restaurant Demo",
    buildingType: "restaurant",
    locationText: "Corner plot, Jakarta",
    actor: ACTOR,
  });

  // v1 baseline through the real pipeline: propose -> validate -> approve/commit.
  const genesis = await proposeChangeSet({
    projectId: project.id,
    source: "SEED",
    intentSummary: "Project Genesis: initial brief and baseline rules",
    operations: [
      { type: "UPSERT_BRIEF", brief },
      ...rules.map((rule) => ({ type: "UPSERT_RULE" as const, rule })),
    ],
    affectedDomains: ["rules", "geometry", "layout"],
    createdBy: ACTOR,
  });
  const validation = await validateChangeSet(genesis.id, ACTOR);
  if (validation.state !== "NEEDS_REVIEW") {
    throw new Error(`Seed genesis validation unexpectedly ${validation.state}`);
  }
  await approveChangeSet({
    changeSetId: genesis.id,
    reviewer: ACTOR,
    note: "Seed baseline approval",
  });

  // Pending ChangeSet with validation warnings (low floor-to-floor).
  const pending = await proposeChangeSet({
    projectId: project.id,
    source: "USER",
    intentSummary: "Explore lower first-floor height to reduce facade cost",
    operations: [
      {
        type: "UPSERT_BRIEF",
        brief: { ...brief, floorToFloorHeightsMm: [3800, 3000] },
      },
    ],
    affectedDomains: ["geometry"],
    createdBy: "demo-user",
  });
  await validateChangeSet(pending.id, "demo-user");

  // One exploratory, non-authoritative canvas alternative.
  await createCanvasArtifact({
    projectId: project.id,
    artifact: {
      artifactType: "concept-sketch",
      title: "Alternative A — double-height dining hall",
      status: "ACTIVE",
      parentArtifactIds: [],
      sourceType: "USER_INPUT",
      sourceReference: undefined,
      metadata: {
        summary:
          "Concept: remove first floor over dining area for a double-height space.",
      },
    },
    actor: "demo-user",
  });

  console.log(`Seeded Restaurant Demo (project ${project.id}).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
