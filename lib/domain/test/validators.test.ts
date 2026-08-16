import { describe, expect, it } from "vitest";
import {
  applyOperations,
  emptySnapshot,
  hasBlockingChecks,
  runValidationGate,
  type BriefInput,
  type CanonicalSnapshot,
  type RuleInput,
} from "../src/index";

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

function snap(brief: BriefInput, rules: RuleInput[] = []): CanonicalSnapshot {
  return { brief, rules, canonicalObjects: [] };
}

describe("Validation Gate", () => {
  it("passes a well-formed brief with satisfied rules", () => {
    const checks = runValidationGate(snap(goodBrief, [circulationRule]));
    expect(hasBlockingChecks(checks)).toBe(false);
    expect(checks.every((c) => c.sourceType)).toBe(true);
  });

  it("every check carries provenance (sourceType + evidence)", () => {
    const checks = runValidationGate(snap(goodBrief, [circulationRule]));
    for (const c of checks) {
      expect(c.sourceType).toBeTruthy();
      expect(c.evidence.length).toBeGreaterThan(0);
    }
    const ruleCheck = checks.find((c) => c.category === "rule.CIRC-MIN-WIDTH");
    expect(ruleCheck?.sourceReference).toBe("Local building code §4.2");
  });

  it("flags non-positive dimensions as BLOCKER", () => {
    const checks = runValidationGate(
      snap({ ...goodBrief, siteWidthMm: -5 as unknown as number }),
    );
    const dim = checks.find((c) => c.category === "dimensions.positive");
    expect(dim?.status).toBe("BLOCKER");
    expect(hasBlockingChecks(checks)).toBe(true);
  });

  it("warns when site dimensions are missing", () => {
    const { siteWidthMm: _w, siteDepthMm: _d, ...rest } = goodBrief;
    const checks = runValidationGate(snap(rest as BriefInput));
    expect(checks.find((c) => c.category === "site.configured")?.status).toBe(
      "WARNING",
    );
  });

  it("blocks non-mm unit declarations", () => {
    const checks = runValidationGate(
      snap({ ...goodBrief, lengthUnit: "inch" }),
    );
    expect(checks.find((c) => c.category === "units.explicit")?.status).toBe(
      "BLOCKER",
    );
  });

  it("warns on unusual floor-to-floor heights, blocks non-positive", () => {
    let checks = runValidationGate(
      snap({ ...goodBrief, floorToFloorHeightsMm: [2000, 3500] }),
    );
    expect(
      checks.find((c) => c.category === "floorToFloor.threshold")?.status,
    ).toBe("WARNING");
    checks = runValidationGate(
      snap({ ...goodBrief, floorToFloorHeightsMm: [0] }),
    );
    expect(
      checks.find((c) => c.category === "floorToFloor.positive")?.status,
    ).toBe("BLOCKER");
  });

  it("blocks inconsistent window sill/head", () => {
    const checks = runValidationGate(
      snap({ ...goodBrief, windowStandards: { sillMm: 2500, headMm: 900 } }),
    );
    expect(
      checks.find((c) => c.category === "window.sillHeadConsistency")?.status,
    ).toBe("BLOCKER");
  });

  it("violated blocking rule yields BLOCKER with provenance", () => {
    const brief = { ...goodBrief, circulation: { minCorridorWidthMm: 800 } };
    const checks = runValidationGate(snap(brief, [circulationRule]));
    const rc = checks.find((c) => c.category === "rule.CIRC-MIN-WIDTH");
    expect(rc?.status).toBe("BLOCKER");
    expect(rc?.sourceReference).toBe("Local building code §4.2");
    expect(hasBlockingChecks(checks)).toBe(true);
  });

  it("blocking rules without provenance produce CRITICAL", () => {
    const bad: RuleInput = { ...circulationRule, sourceReference: undefined };
    const checks = runValidationGate(snap(goodBrief, [bad]));
    expect(
      checks.find((c) => c.category === "rules.provenanceRequired")?.status,
    ).toBe("CRITICAL");
  });
});

describe("applyOperations", () => {
  it("never mutates the base snapshot", () => {
    const base = snap(goodBrief, [circulationRule]);
    const frozen = JSON.stringify(base);
    const next = applyOperations(base, [
      { type: "UPSERT_BRIEF", brief: { ...goodBrief, levels: 5 } },
      { type: "DEACTIVATE_RULE", ruleCode: "CIRC-MIN-WIDTH" },
    ]);
    expect(JSON.stringify(base)).toBe(frozen);
    expect(next.brief?.levels).toBe(5);
    expect(next.rules[0]?.active).toBe(false);
  });

  it("upserts rules and canonical objects by key", () => {
    const base = emptySnapshot();
    const next = applyOperations(base, [
      { type: "UPSERT_RULE", rule: circulationRule },
      {
        type: "UPSERT_RULE",
        rule: { ...circulationRule, expectedValue: 1100 },
      },
      {
        type: "UPSERT_CANONICAL_OBJECT",
        object: {
          archonId: "AR-SPACE-00000000-0000-0000-0000-000000000000",
          objectType: "space",
          parameters: { name: "Dining" },
          relationships: [],
          provenance: { sourceType: "USER_INPUT" },
        },
      },
    ]);
    expect(next.rules).toHaveLength(1);
    expect(next.rules[0]?.expectedValue).toBe(1100);
    expect(next.canonicalObjects).toHaveLength(1);
  });
});
