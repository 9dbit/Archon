# E7 AI Design Engine v1

## Goal

Introduce a governed design-generation layer for space-planning alternatives without allowing AI output to mutate the approved Building Graph directly.

## Design principle

Every generated alternative is a proposal candidate. The AI engine may suggest room sizes, adjacencies, circulation moves, capacity changes, and object updates, but every selected alternative must be converted into a normal ARCHON ChangeSet and pass the existing validation, review, approval, and immutable version pipeline.

## Slice E7.1: Structured design alternatives

Input:
- project brief
- current approved version
- canonical rooms/spaces
- user objective such as `maximize seats`, `improve kitchen workflow`, `reduce service travel`, or `preserve ocean view`

Output:
- 3 to 5 deterministic alternatives
- score dimensions
- rationale
- canonical operations preview
- no approved-state mutation

Each alternative has:

```ts
type DesignAlternative = {
  id: string;
  title: string;
  strategy: string;
  objective: string;
  score: {
    capacity: number;
    circulation: number;
    operations: number;
    cost: number;
  };
  rationale: string[];
  operations: CanonicalGeometryOperation[];
};
```

## Governance

`Generate Alternatives -> Inspect -> Select -> Proposed ChangeSet -> Validate -> Review -> Approve -> Immutable Version`

Selection must call the existing proposal boundary. Alternative generation itself is read-only.

## E7 roadmap

1. E7.1 deterministic alternative generator and Layout Studio UI
2. E7.2 brief-aware constraint model
3. E7.3 adjacency and circulation scoring
4. E7.4 multi-operation ChangeSet preview
5. E7.5 provider-neutral AI adapter boundary
6. E7.6 learned Design DNA as optional ranking context

## Initial safety constraints

- generated operations may only target objects in the current project
- dimensions must remain positive and within configured proposal limits
- every generated operation must pass the same proposal normalization used by manual editing
- alternatives are ephemeral/read-only until explicitly selected
- selecting an alternative creates a governed proposal, never an approval
- existing approved versions remain immutable
