# ARCHON Concept Sandbox V0.1

This is an optional, separate SketchUp extension for generating editable conceptual geometry from the JSON produced by the ARCHON reference-image preview.

Safety: only blank, unsaved models are permitted. A user must explicitly confirm before geometry is generated. No existing model, production ChangeSet, network call or automatic save is involved. The governed ARCHON executor stays locked.

Workflow:
1. Use the ARCHON Image to 3D Concept (Preview) menu to analyze an image, review assumptions, and export its JSON.
2. Create a fresh empty SketchUp model; remove any default example entities.
3. Install ARCHON-Concept-Sandbox.rbz.
4. Select Extensions > ARCHON Concept Sandbox > Import reviewed concept JSON.
5. Explicitly confirm the new geometry. All objects are editable groups, and Undo is available.
6. Manually save a new .skp only after checking the result.

Limitations: only flat roofs, 1-4 floors, front glazing, balcony and vertical fins. Not surveyed accuracy, interiors, BIM, engineering, drawing documentation or verified reconstruction of hidden details.

CI packages the sandbox into an installable RBZ ZIP after syntax and safety tests.
