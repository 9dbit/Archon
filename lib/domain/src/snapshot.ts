import type { CanonicalSnapshot, ChangeSetOperation } from "./types";

export function emptySnapshot(): CanonicalSnapshot {
  return { brief: null, rules: [], canonicalObjects: [] };
}

/**
 * Pure application of ChangeSet operations to a canonical snapshot.
 * Never mutates the input — callers rely on the baseline staying intact.
 */
export function applyOperations(
  base: CanonicalSnapshot,
  operations: ChangeSetOperation[],
): CanonicalSnapshot {
  let next: CanonicalSnapshot = structuredClone(base);
  for (const op of operations) {
    switch (op.type) {
      case "UPSERT_BRIEF":
        next = { ...next, brief: structuredClone(op.brief) };
        break;
      case "UPSERT_RULE": {
        const rules = next.rules.filter((r) => r.code !== op.rule.code);
        rules.push(structuredClone(op.rule));
        next = { ...next, rules };
        break;
      }
      case "DEACTIVATE_RULE":
        next = {
          ...next,
          rules: next.rules.map((r) =>
            r.code === op.ruleCode ? { ...r, active: false } : r,
          ),
        };
        break;
      case "UPSERT_CANONICAL_OBJECT": {
        const objects = next.canonicalObjects.filter(
          (o) => o.archonId !== op.object.archonId,
        );
        objects.push(structuredClone(op.object));
        next = { ...next, canonicalObjects: objects };
        break;
      }
    }
  }
  return next;
}
