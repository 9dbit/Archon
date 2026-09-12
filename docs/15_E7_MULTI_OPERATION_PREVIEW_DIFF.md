# E7.4 Multi-Operation Preview & Diff

E7.4 completes governed review UX for coordinated ChangeSets before external CAD adapters are introduced.

## Implemented

- complete multi-operation ghost preview in 3D Studio
- sequential preview when multiple operations target the same canonical object
- before/after position and size diff per affected object
- affected-object list with operation type and changed axes/dimensions
- click a diff row in 3D Studio to select/highlight the canonical object
- Layout Studio surfaces the same governed before/after ChangeSet diff
- active ChangeSet validation summary is visible beside preview context
- Preview Changes control navigates to the governed diff review
- transform gizmo remains disabled while a proposal preview is active

## Governance boundary

Preview is derived from approved canonical geometry plus the active ChangeSet operations. It does not mutate approved state. Approval continues to create a new immutable version through the existing governed workflow.

## Remaining external integration boundary

No Autodesk/AutoCAD credential, API call, DWG mutation, or adapter write is introduced in E7.4. External CAD starts only after the E7.5 design-intelligence checkpoint is complete.
