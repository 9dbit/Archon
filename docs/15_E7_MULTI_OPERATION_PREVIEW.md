# E7.4 — Governed Multi-Operation Preview

## Goal

Make coordinated AI design proposals legible before approval. A ChangeSet containing several operations must preview the entire batch, not only its first operation.

## Slice 1 implemented here

- 3D Studio consumes the complete `ChangeSet.operations` array.
- every affected canonical object receives a ghost preview.
- multiple operations targeting the same object are applied sequentially in proposal order.
- approved geometry remains rendered as the base state while proposed geometry remains translucent and read-only.
- preview status reports operation count, affected-object count, MOVE count and UPDATE count.
- transform gizmo is disabled while any governed preview is active.

## Governance

Preview is sandbox-only. It does not mutate approved canonical state, create a version, or bypass approval.

`Approved Building Graph -> ChangeSet operation batch -> ghost materialization -> review -> approval`

## E7.4 remaining slices

1. affected-object diff list with readable before/after dimensions and positions;
2. per-object focus/highlight from the diff list;
3. explicit preview state in Layout Studio, not only 3D Studio;
4. validation findings correlated to affected objects;
5. review polish before the integration milestone.

The AutoCAD adapter remains later work. E7.4 must be completed and validated first.
