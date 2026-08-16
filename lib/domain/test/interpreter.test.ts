import { describe, expect, it } from "vitest";
import { interpretBriefDeterministic } from "../src/interpreter";

// Exact placeholder text advertised in the New Project UI.
const UI_PLACEHOLDER =
  "The client wants a 10-story commercial building on a 50m x 40m site. " +
  "Floor to floor heights should be 3600mm. Minimum corridor width 1500mm.";

describe("interpretBriefDeterministic", () => {
  it("parses the UI placeholder brief exactly", () => {
    const { brief } = interpretBriefDeterministic(UI_PLACEHOLDER);
    expect(brief.levels).toBe(10);
    expect(brief.siteWidthMm).toBe(50000);
    expect(brief.siteDepthMm).toBe(40000);
    expect(brief.floorToFloorHeightsMm).toHaveLength(10);
    expect(brief.floorToFloorHeightsMm?.every((h) => h === 3600)).toBe(true);
    expect(brief.circulation?.minCorridorWidthMm).toBe(1500);
  });

  it("supports hyphenated and plain level phrasing", () => {
    expect(interpretBriefDeterministic("a 10-story tower").brief.levels).toBe(
      10,
    );
    expect(interpretBriefDeterministic("2 storey house").brief.levels).toBe(2);
    expect(interpretBriefDeterministic("3 levels of retail").brief.levels).toBe(
      3,
    );
  });

  it("distinguishes mm and m for floor-to-floor heights", () => {
    expect(
      interpretBriefDeterministic("floor-to-floor 3600mm").brief
        .floorToFloorHeightsMm,
    ).toEqual([3600]);
    expect(
      interpretBriefDeterministic("floor to floor 3.5m").brief
        .floorToFloorHeightsMm,
    ).toEqual([3500]);
    expect(
      interpretBriefDeterministic("3.6m floor to floor").brief
        .floorToFloorHeightsMm,
    ).toEqual([3600]);
  });

  it("applies a magnitude heuristic when the unit is omitted", () => {
    const large = interpretBriefDeterministic("floor to floor of 3600");
    expect(large.brief.floorToFloorHeightsMm).toEqual([3600]);
    expect(large.assumptions.join(" ")).toMatch(/millimetres/);
    const small = interpretBriefDeterministic("floor to floor of 3.5");
    expect(small.brief.floorToFloorHeightsMm).toEqual([3500]);
    expect(small.assumptions.join(" ")).toMatch(/metres/);
  });
});
