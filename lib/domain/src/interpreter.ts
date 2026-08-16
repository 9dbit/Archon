import type { BriefInput } from "./types";
import { LENGTH_UNIT } from "./types";

export interface BriefInterpretation {
  brief: BriefInput;
  assumptions: string[];
  providerId: string;
  confidence: number;
}

const PROGRAM_KEYWORDS: Array<[RegExp, string]> = [
  [/dining/i, "Dining area"],
  [/kitchen/i, "Kitchen"],
  [/bar\b/i, "Bar"],
  [/(restroom|toilet|wc|bathroom)/i, "Restrooms"],
  [/storage/i, "Storage"],
  [/office/i, "Office"],
  [/terrace|outdoor/i, "Outdoor terrace"],
  [/lobby|entry|entrance/i, "Entry / lobby"],
];

function metresToMm(v: number): number {
  return Math.round(v * 1000);
}

/**
 * Deterministic brief interpreter — the only interpreter active in Phase 0.
 * Pure text parsing; no external model calls.
 */
export function interpretBriefDeterministic(text: string): BriefInterpretation {
  const assumptions: string[] = [];
  const brief: BriefInput = { lengthUnit: LENGTH_UNIT };

  // Site "20m x 30m" / "20 x 30 m" / "20x30"
  const site =
    text.match(/(\d+(?:\.\d+)?)\s*m?\s*[x×]\s*(\d+(?:\.\d+)?)\s*m\b/i) ??
    text.match(/site\D{0,20}(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (site) {
    brief.siteWidthMm = metresToMm(parseFloat(site[1]!));
    brief.siteDepthMm = metresToMm(parseFloat(site[2]!));
    assumptions.push(
      "Site dimensions interpreted as metres and converted to mm.",
    );
  }

  // Levels "2 storey/story/levels/floors"
  const levels = text.match(
    /(\d+)\s*(?:storey|story|stories|storeys|levels?|floors?)\b/i,
  );
  if (levels) brief.levels = parseInt(levels[1]!, 10);

  // Floor-to-floor "3.5m floor to floor" / "floor-to-floor 3.5"
  const f2f =
    text.match(/floor[\s-]*to[\s-]*floor\D{0,10}(\d+(?:\.\d+)?)\s*m?/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*m\s*floor[\s-]*to[\s-]*floor/i);
  if (f2f) {
    const h = metresToMm(parseFloat(f2f[1]!));
    brief.floorToFloorHeightsMm = Array.from(
      { length: brief.levels ?? 1 },
      () => h,
    );
    assumptions.push("Same floor-to-floor height assumed for all levels.");
  }

  // Corridor minimum "corridor(s) min 1.2m" / "1200mm corridors"
  const corridor =
    text.match(/corridors?\D{0,20}(\d+(?:\.\d+)?)\s*(mm|m)\b/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*(mm|m)\s*corridors?/i);
  if (corridor) {
    const raw = parseFloat(corridor[1]!);
    const mm =
      corridor[2]!.toLowerCase() === "m" ? metresToMm(raw) : Math.round(raw);
    brief.circulation = { minCorridorWidthMm: mm };
  }

  // Target GFA "GFA 450 sqm/m2"
  const gfa = text.match(/gfa\D{0,10}(\d+(?:\.\d+)?)\s*(?:sqm|m2|m²)/i);
  if (gfa) brief.targetGfaSqm = parseFloat(gfa[1]!);

  const program = PROGRAM_KEYWORDS.filter(([re]) => re.test(text)).map(
    ([, name]) => ({ name }),
  );
  if (program.length) brief.programRequirements = program;

  brief.notes = text.trim();
  if (!site) assumptions.push("No site dimensions detected in the text.");

  return {
    brief,
    assumptions,
    providerId: "deterministic-mock-v1",
    confidence: site ? 0.8 : 0.5,
  };
}
