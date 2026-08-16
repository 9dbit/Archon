# ARCHON UI & Workspace Specification v0.1

## Product UX principle

ARCHON should feel like an architecture studio workspace with AI embedded everywhere, not a chatbot attached to CAD.

The interface must support two modes:

1. **Canvas Mode** — exploratory, branching, visual and permissive.
2. **Building Mode** — authoritative, measured, validated and approval-driven.

The user must always know which mode they are in.

---

# Global shell

```text
+--------------------------------------------------------------------------------+
| ARCHON | Project | Stage | Mode | Sync Health | Version | Pending Approvals    |
+----------------------+--------------------------------------+-------------------+
|                      |                                      |                   |
| AI COMMAND CENTER    | MAIN WORKSPACE                       | CONTEXT /         |
|                      |                                      | VALIDATION        |
| text                 | Canvas / Plan / 3D / Drawing         |                   |
| voice                |                                      | selection         |
| prompt history       |                                      | properties        |
| decisions            |                                      | rules             |
| suggestions          |                                      | impacts           |
|                      |                                      | checklist         |
+----------------------+--------------------------------------+-------------------+
| VERSION / DECISION / ALTERNATIVE TIMELINE                                       |
+--------------------------------------------------------------------------------+
```

---

# Canvas Mode

## Main workspace

Infinite canvas supporting:
- cards
- images
- plans
- sketches
- references
- layout alternatives
- render alternatives
- concept 3D previews
- notes/comments
- workflow nodes
- approval markers

## Key interactions

### Prompt anywhere
Select artifact(s) and give a text/voice command.

Example:
> Make the bar more organic, keep the circulation path and column positions fixed.

### Markup
- pen/sketch
- circle
- arrow
- highlight
- line
- region selection
- text note

### Alternative branching
Any artifact can branch into A/B/C without deleting its parent.

### Compare mode
Side-by-side or overlay alternatives with:
- design differences
- rule score
- area impact
- seat/capacity impact
- material implications
- cost estimate when available

### Design Lock panel

```text
GEOMETRY     LOCKED
STRUCTURE    LOCKED
LAYOUT       LOCKED
MATERIAL     EDITABLE
LIGHTING     EDITABLE
CAMERA       EDITABLE
```

Locks travel with the AI request.

### Promote to Building Model
Visible only on eligible selected artifacts.

Promotion launches:
- semantic preview
- unresolved dimensions
- inferred object list
- rule conflicts
- confidence
- validation checklist
- approval

---

# Building Mode

## Workspace tabs
- Plan
- 3D
- Elevation
- Section
- Materials
- BIM
- MEP
- Drawings
- BOQ
- Validation

## Object selection
Selecting an object shows:
- ARCHON ID
- type
- dimensions
- material
- room/level relationship
- source/provenance
- constraints
- external mappings
- revision
- dependent assets

## Contextual command examples

> Move this wall 300 mm east, do not move the column.

> Replace this material with MAT-A14 everywhere in VIP rooms only.

> Make this window 2400 mm high with sill at 600 mm.

> Generate construction detail for this bar counter.

Commands create proposed changes, never silent commits.

---

# Validation panel

Every authoritative proposal has a compact summary:

```text
ChangeSet CHG-0241
Validation Score 91/100

Geometry        PASS
Dimensions      WARNING
Materials       PASS
Structure       PASS
MEP             WARNING
Project Rules   PASS
Documentation   PASS
Cost            UPDATED
```

Each issue expands into:
- observed value
- expected value
- rule/source
- evidence
- affected objects
- suggested fixes
- confidence

Actions:
- Edit
- Apply Suggested Fix
- Try Alternative
- Re-run Validation
- Reject
- Approve Commit

Critical/blocker issues disable normal approval unless policy explicitly permits waiver.

---

# Timeline

Bottom timeline combines:
- versions
- important decisions
- approvals
- alternatives
- issue baselines

Users can:
- compare versions
- inspect decision reason
- restore a branch
- selectively reapply a prior object state in later phases

---

# Collaboration

Comments can attach to:
- canvas region
- semantic object
- drawing
- validation item
- version

Role-sensitive actions:
- Client: comment/review
- Designer: explore/propose
- Discipline reviewer: approve discipline
- Principal/owner: final approval

---

# Project dashboard

Shows:
- stage
- current approved version
- sync health
- unresolved blockers
- pending approvals
- stale derived assets
- milestone health
- next presentation
- recent decisions

---

# Mobile/tablet philosophy

Desktop remains primary for full design authoring.

Mobile/tablet should prioritize:
- voice command
- project review
- comments/markup
- validation review
- approvals
- timeline/status
- render/layout comparison

Do not force full BIM editing into a phone UI.

---

# UX guardrails

1. Always label Canvas vs Building Mode clearly.
2. Never make an exploratory image look authoritative.
3. Always show when an asset is stale.
4. Always show which rule/source caused a validation result.
5. Always show before/after for authoritative commits.
6. Make destructive or high-impact actions reversible and explicit.
7. Use architecture terminology rather than generic SaaS language where useful.
8. Keep AI suggestions visually distinct from approved project truth.
