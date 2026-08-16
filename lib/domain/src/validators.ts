import type {
  CanonicalSnapshot,
  RuleInput,
  RuleSubject,
  ValidationCheckInput,
  ValidationStatus,
} from "./types";
import { LENGTH_UNIT } from "./types";

/**
 * Deterministic Validation Gate (docs/03, docs/05 §6).
 * Pure function of the proposed (sandboxed) snapshot. Every check carries
 * provenance (sourceType / sourceReference) and evidence.
 */

function check(
  partial: Partial<ValidationCheckInput> &
    Pick<
      ValidationCheckInput,
      "category" | "status" | "evidence" | "sourceType"
    >,
): ValidationCheckInput {
  return {
    severity:
      partial.status === "PASS"
        ? "INFO"
        : (partial.status as Exclude<ValidationStatus, "PASS">),
    observedValue: null,
    expectedValue: null,
    unit: null,
    sourceReference: null,
    recommendation: null,
    confidence: 1,
    ...partial,
  };
}

const MIN_SITE_MM = 3_000;
const MAX_SITE_MM = 1_000_000;
const FLOOR_TO_FLOOR_WARN_MIN_MM = 2_400;
const FLOOR_TO_FLOOR_WARN_MAX_MM = 6_000;

export function validateUnits(s: CanonicalSnapshot): ValidationCheckInput[] {
  if (!s.brief) return [];
  const ok = s.brief.lengthUnit === LENGTH_UNIT;
  return [
    check({
      category: "units.explicit",
      status: ok ? "PASS" : "BLOCKER",
      observedValue: s.brief.lengthUnit,
      expectedValue: LENGTH_UNIT,
      unit: null,
      sourceType: "DETERMINISTIC_RULE",
      sourceReference: "docs/02_SYSTEM_ARCHITECTURE.md#canonical-units",
      evidence: ok
        ? `Brief declares canonical length unit '${LENGTH_UNIT}'.`
        : `Brief declares unit '${s.brief.lengthUnit}', canonical unit is '${LENGTH_UNIT}'.`,
      recommendation: ok ? null : `Convert all lengths to ${LENGTH_UNIT}.`,
    }),
  ];
}

export function validateDimensionsPositive(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  if (!s.brief) return [];
  const b = s.brief;
  const dims: Array<[string, number | undefined]> = [
    ["siteWidthMm", b.siteWidthMm],
    ["siteDepthMm", b.siteDepthMm],
    ["doorStandards.widthMm", b.doorStandards?.widthMm],
    ["doorStandards.heightMm", b.doorStandards?.heightMm],
    ["windowStandards.sillMm", b.windowStandards?.sillMm],
    ["windowStandards.headMm", b.windowStandards?.headMm],
    ["circulation.minCorridorWidthMm", b.circulation?.minCorridorWidthMm],
    ...(b.floorToFloorHeightsMm ?? []).map(
      (v, i) => [`floorToFloorHeightsMm[${i}]`, v] as [string, number],
    ),
  ];
  const bad = dims.filter(([, v]) => v !== undefined && v <= 0);
  return [
    check({
      category: "dimensions.positive",
      status: bad.length ? "BLOCKER" : "PASS",
      observedValue: bad.length
        ? bad.map(([k, v]) => `${k}=${v}`).join(", ")
        : "all supplied dimensions > 0",
      expectedValue: "> 0",
      unit: LENGTH_UNIT,
      sourceType: "DETERMINISTIC_RULE",
      sourceReference:
        "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
      evidence: bad.length
        ? `Non-positive dimensions: ${bad.map(([k]) => k).join(", ")}.`
        : "All supplied dimensions are positive.",
      recommendation: bad.length
        ? "Correct the non-positive dimensions."
        : null,
    }),
  ];
}

export function validateSiteConfigured(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  if (!s.brief) return [];
  const { siteWidthMm, siteDepthMm } = s.brief;
  if (siteWidthMm === undefined || siteDepthMm === undefined) {
    return [
      check({
        category: "site.configured",
        status: "WARNING",
        observedValue: `width=${siteWidthMm ?? "missing"}, depth=${siteDepthMm ?? "missing"}`,
        expectedValue: "width and depth configured",
        unit: LENGTH_UNIT,
        sourceType: "DETERMINISTIC_RULE",
        sourceReference:
          "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
        evidence: "Site dimensions are not fully configured.",
        recommendation: "Provide site width and depth in millimetres.",
      }),
    ];
  }
  const reasonable =
    siteWidthMm >= MIN_SITE_MM &&
    siteWidthMm <= MAX_SITE_MM &&
    siteDepthMm >= MIN_SITE_MM &&
    siteDepthMm <= MAX_SITE_MM;
  return [
    check({
      category: "site.configured",
      status: reasonable ? "PASS" : "WARNING",
      observedValue: `${siteWidthMm} x ${siteDepthMm}`,
      expectedValue: `${MIN_SITE_MM}..${MAX_SITE_MM} per side`,
      unit: LENGTH_UNIT,
      sourceType: "DETERMINISTIC_RULE",
      sourceReference:
        "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
      evidence: reasonable
        ? "Site dimensions are configured and within a reasonable range."
        : "Site dimensions fall outside the reasonable range.",
      recommendation: reasonable ? null : "Re-check the site survey figures.",
    }),
  ];
}

export function validateFloorToFloor(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  const heights = s.brief?.floorToFloorHeightsMm;
  if (!heights || heights.length === 0) return [];
  const nonPositive = heights.filter((h) => h <= 0);
  if (nonPositive.length) {
    return [
      check({
        category: "floorToFloor.positive",
        status: "BLOCKER",
        observedValue: heights.join(", "),
        expectedValue: "> 0",
        unit: LENGTH_UNIT,
        sourceType: "DETERMINISTIC_RULE",
        sourceReference:
          "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
        evidence: `Non-positive floor-to-floor heights: ${nonPositive.join(", ")}.`,
        recommendation: "Floor-to-floor heights must be positive millimetres.",
      }),
    ];
  }
  const outside = heights.filter(
    (h) => h < FLOOR_TO_FLOOR_WARN_MIN_MM || h > FLOOR_TO_FLOOR_WARN_MAX_MM,
  );
  return [
    check({
      category: "floorToFloor.threshold",
      status: outside.length ? "WARNING" : "PASS",
      observedValue: heights.join(", "),
      expectedValue: `${FLOOR_TO_FLOOR_WARN_MIN_MM}..${FLOOR_TO_FLOOR_WARN_MAX_MM}`,
      unit: LENGTH_UNIT,
      sourceType: "DETERMINISTIC_RULE",
      sourceReference:
        "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
      evidence: outside.length
        ? `Heights outside comfort threshold: ${outside.join(", ")}.`
        : "All floor-to-floor heights within threshold.",
      recommendation: outside.length
        ? "Confirm unusual floor-to-floor heights are intentional."
        : null,
    }),
  ];
}

export function validateWindowConsistency(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  const w = s.brief?.windowStandards;
  if (!w || w.sillMm === undefined || w.headMm === undefined) return [];
  const minFloor = s.brief?.floorToFloorHeightsMm?.length
    ? Math.min(...s.brief.floorToFloorHeightsMm)
    : undefined;
  const sillBelowHead = w.sillMm < w.headMm;
  const headFits = minFloor === undefined || w.headMm <= minFloor;
  const ok = sillBelowHead && headFits;
  return [
    check({
      category: "window.sillHeadConsistency",
      status: ok ? "PASS" : "BLOCKER",
      observedValue: `sill=${w.sillMm}, head=${w.headMm}${minFloor !== undefined ? `, minFloorToFloor=${minFloor}` : ""}`,
      expectedValue: "sill < head <= floor-to-floor",
      unit: LENGTH_UNIT,
      sourceType: "DETERMINISTIC_RULE",
      sourceReference:
        "docs/05_REPLIT_MASTER_PROMPT.md#6-initial-deterministic-validations",
      evidence: ok
        ? "Window sill/head heights are consistent."
        : !sillBelowHead
          ? "Window sill is not below window head."
          : "Window head exceeds the lowest floor-to-floor height.",
      recommendation: ok ? null : "Adjust sill/head heights.",
    }),
  ];
}

export function validateBlockingRuleProvenance(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  return s.rules
    .filter(
      (r) =>
        r.active && (r.severity === "BLOCKER" || r.severity === "CRITICAL"),
    )
    .filter((r) => !r.sourceReference)
    .map((r) =>
      check({
        category: "rules.provenanceRequired",
        status: "CRITICAL",
        observedValue: `rule ${r.code} has no sourceReference`,
        expectedValue: "blocking rules cite a source",
        unit: null,
        sourceType: "DETERMINISTIC_RULE",
        sourceReference: "docs/03_VALIDATION_APPROVAL.md",
        evidence: `Rule ${r.code} (${r.severity}) lacks provenance; blocking rules must cite a source.`,
        recommendation: `Add a sourceReference to rule ${r.code}.`,
      }),
    );
}

function observeSubject(
  s: CanonicalSnapshot,
  subject: RuleSubject,
): number | undefined {
  const b = s.brief;
  switch (subject) {
    case "corridorWidthMm":
      return b?.circulation?.minCorridorWidthMm;
    case "doorWidthMm":
      return b?.doorStandards?.widthMm;
    case "doorHeightMm":
      return b?.doorStandards?.heightMm;
    case "floorToFloorMm":
      return b?.floorToFloorHeightsMm?.length
        ? Math.min(...b.floorToFloorHeightsMm)
        : undefined;
    case "windowSillMm":
      return b?.windowStandards?.sillMm;
    case "windowHeadMm":
      return b?.windowStandards?.headMm;
    case "levels":
      return b?.levels;
    case "siteWidthMm":
      return b?.siteWidthMm;
    case "siteDepthMm":
      return b?.siteDepthMm;
  }
}

function ruleSatisfied(
  op: RuleInput["operator"],
  observed: number,
  expected: number,
): boolean {
  switch (op) {
    case ">=":
      return observed >= expected;
    case "<=":
      return observed <= expected;
    case "==":
      return observed === expected;
    case ">":
      return observed > expected;
    case "<":
      return observed < expected;
  }
}

/** Evaluate active project rules (circulation minimum, door/window checks, ...). */
export function validateProjectRules(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  return s.rules
    .filter((r) => r.active)
    .map((r) => {
      const observed = observeSubject(s, r.subject);
      if (observed === undefined) {
        return check({
          category: `rule.${r.code}`,
          status: "WARNING",
          observedValue: null,
          expectedValue: `${r.operator} ${r.expectedValue}`,
          unit: r.unit,
          sourceType: r.sourceType,
          sourceReference: r.sourceReference ?? null,
          evidence: `No observed value for '${r.subject}'; rule ${r.code} cannot be evaluated.`,
          recommendation: `Supply '${r.subject}' in the brief so rule ${r.code} can be checked.`,
        });
      }
      const ok = ruleSatisfied(r.operator, observed, r.expectedValue);
      return check({
        category: `rule.${r.code}`,
        status: ok
          ? "PASS"
          : r.severity === "INFO"
            ? "WARNING"
            : (r.severity as ValidationStatus),
        observedValue: String(observed),
        expectedValue: `${r.operator} ${r.expectedValue}`,
        unit: r.unit,
        sourceType: r.sourceType,
        sourceReference: r.sourceReference ?? null,
        evidence: ok
          ? `${r.subject} = ${observed} satisfies ${r.code} (${r.operator} ${r.expectedValue} ${r.unit}).`
          : `${r.subject} = ${observed} violates ${r.code} (${r.operator} ${r.expectedValue} ${r.unit}): ${r.description}`,
        recommendation: ok ? null : `Adjust ${r.subject} to satisfy ${r.code}.`,
      });
    });
}

/** Run the full deterministic Validation Gate against a sandboxed snapshot. */
export function runValidationGate(
  s: CanonicalSnapshot,
): ValidationCheckInput[] {
  return [
    ...validateUnits(s),
    ...validateDimensionsPositive(s),
    ...validateSiteConfigured(s),
    ...validateFloorToFloor(s),
    ...validateWindowConsistency(s),
    ...validateBlockingRuleProvenance(s),
    ...validateProjectRules(s),
  ];
}

/** BLOCKER or CRITICAL prevents normal approval (docs/03). */
export function hasBlockingChecks(
  checks: Array<Pick<ValidationCheckInput, "status">>,
): boolean {
  return checks.some((c) => c.status === "BLOCKER" || c.status === "CRITICAL");
}
