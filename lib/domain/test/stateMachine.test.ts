import { describe, expect, it } from "vitest";
import {
  CHANGE_SET_STATES,
  assertTransition,
  canTransition,
  isEditable,
  isTerminal,
} from "../src/index";

describe("ChangeSet state machine", () => {
  it("allows the happy path DRAFT -> ... -> COMMITTED", () => {
    const path = [
      "DRAFT",
      "PROPOSED",
      "SANDBOXED",
      "VALIDATING",
      "NEEDS_REVIEW",
      "APPROVED",
      "COMMITTING",
      "COMMITTED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });

  it("allows validation failure and correction loop", () => {
    expect(canTransition("VALIDATING", "VALIDATION_FAILED")).toBe(true);
    expect(canTransition("VALIDATION_FAILED", "PROPOSED")).toBe(true);
    expect(canTransition("NEEDS_REVIEW", "PROPOSED")).toBe(true);
    expect(canTransition("NEEDS_REVIEW", "REJECTED")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("DRAFT", "COMMITTED")).toBe(false);
    expect(canTransition("PROPOSED", "APPROVED")).toBe(false);
    expect(canTransition("VALIDATING", "APPROVED")).toBe(false);
    expect(canTransition("NEEDS_REVIEW", "COMMITTED")).toBe(false);
    expect(canTransition("REJECTED", "PROPOSED")).toBe(false);
    expect(canTransition("COMMITTED", "DRAFT")).toBe(false);
    expect(() => assertTransition("DRAFT", "APPROVED")).toThrow(
      /Illegal ChangeSet transition/,
    );
  });

  it("marks COMMITTED and REJECTED as terminal only", () => {
    const terminals = CHANGE_SET_STATES.filter(isTerminal);
    expect(terminals.sort()).toEqual(["COMMITTED", "REJECTED"]);
  });

  it("permits editing only in DRAFT / NEEDS_REVIEW / VALIDATION_FAILED", () => {
    const editable = CHANGE_SET_STATES.filter(isEditable);
    expect(editable.sort()).toEqual([
      "DRAFT",
      "NEEDS_REVIEW",
      "VALIDATION_FAILED",
    ]);
  });
});
