# ARCHON AI Router, Knowledge & Design DNA v0.1

## Objective

ARCHON must not depend on one AI model. It should route tasks to the best available capability while preserving a single product experience and a single validation/governance model.

---

# 1. ARCHON Model Router

## Task classes

### Reasoning
Used for:
- brief interpretation
- design critique
- alternatives reasoning
- rule explanation
- project planning

### Realtime / Voice
Used for:
- conversational editing
- hands-free commands
- review sessions

### Image Generation
Used for:
- facade studies
- interior style alternatives
- mood/material studies

### Image Editing
Used for:
- region-based material/style changes
- controlled visual revisions

### 3D Generation
Used for:
- concept furniture
- concept objects
- non-authoritative exploratory geometry

### Rendering / Enhancement
Used for:
- photorealistic output
- lighting studies
- upscaling

### Retrieval / Embeddings
Used for:
- materials
- regulations
- company standards
- project precedent
- external research

### Parametric / Optimization
Used for:
- layout search
- facade patterns
- parking
- organic forms
- geometric optimization

---

# 2. Routing policy

Every AI request should describe:
- task type
- project id
- allowed data scope
- editable domains
- locked domains
- expected output schema
- quality target
- latency tolerance
- cost ceiling when relevant
- privacy requirement

Router selects provider/model using:
- capability match
- health/availability
- output quality history
- latency
- cost
- data/privacy policy
- project/company preference

Provider-specific outputs are normalized into typed ARCHON responses.

---

# 3. AI safety boundary for architecture

AI may propose:
- design alternatives
- semantic classifications
- inferred dimensions
- material matches
- rule interpretations
- suggested technical solutions

AI may not silently promote these into authoritative state.

Critical outputs must include where applicable:
- confidence
- source/provenance
- unresolved ambiguity
- affected scope
- validation requirement

Generated code is never executed directly as an architectural command. AI intent becomes structured domain operations first.

---

# 4. Design DNA

Design DNA is the firm's approved reusable architectural intelligence.

It is not one style embedding.

## Domains

### Spatial DNA
- preferred room proportions
- circulation tendencies
- adjacency patterns
- seating density
- kitchen/service relationships

### Material DNA
- preferred brands
- material palettes
- common assemblies
- wet-area preferences
- durability preferences

### Furniture DNA
- preferred furniture families
- clearances
- dimensions
- custom detail patterns

### Lighting DNA
- CCT preferences
- accent/ambient balance
- common fixture strategies
- facade lighting principles

### Detail DNA
- recurring joinery details
- wall/floor/ceiling assemblies
- hardware preferences

### Visual DNA
- approved aesthetic references
- rendering style
- facade/interior language

### Process DNA
- project workflows
- review gates
- drawing standards
- naming conventions
- typical timelines

---

# 5. Learning lifecycle

```text
Observation
-> Learning Candidate
-> Evidence / frequency analysis
-> Proposed Company Knowledge
-> Review
-> Approval
-> Active Design DNA / Rule
```

Example:

> ARCHON observes that service circulation was manually corrected to 1000 mm or more in 8 restaurant projects.

ARCHON may propose:

> "Create Mark Studios Restaurant Rule: Service circulation minimum 1000 mm?"

Until approved, it remains a suggestion.

---

# 6. Knowledge layers

## Project Knowledge
Only applies to one project.

Examples:
- client decisions
- approved materials
- special dimensions
- project-specific standards

## Company Knowledge
Reusable approved studio rules/preferences.

## External Knowledge
Retrieved from:
- regulations
- manufacturer technical sources
- credible professional sources
- curated research

External knowledge is not automatically promoted into company rules.

---

# 7. Provenance model

Every authoritative knowledge item should record:
- source type
- source reference
- source date
- jurisdiction if applicable
- applicable building type
- author/reviewer
- approval timestamp
- revision
- confidence/freshness

ARCHON must be able to answer:

> Why are you recommending this?

with traceable evidence.

---

# 8. Contradiction handling

If two valid sources conflict:
- never hide the conflict
- show both sources
- explain applicability differences
- request project/jurisdiction decision when necessary
- store the chosen interpretation for the project

---

# 9. Research Agent

Research should run as a controlled pipeline:

```text
Question
-> search trusted source classes
-> collect evidence
-> compare sources
-> summarize
-> confidence/freshness
-> architect review
-> optional promotion to project/company knowledge
```

It must not continuously absorb arbitrary internet content into authoritative memory.

---

# 10. Privacy and tenancy

Design DNA and company knowledge are private assets.

Future architecture must support:
- tenant isolation
- project permissions
- source access controls
- private model/provider policy
- opt-in learning scopes

No client project should become training material for another tenant by default.
