# E8 Command Prompt Center sandbox MVP

ARCHON now has a Command Prompt Center sandbox path for CAD/layout editing prompts. The preview endpoint normalizes text into an ARCHON Intent, resolves canonical Building Graph targets, produces a Proposed ChangeSet draft payload when the command is concrete, and returns a validation/checklist envelope. The endpoint is read-only and does not write to the database.

The first deterministic commands cover the real AutoCAD test path without executing it: move a named wall by an exact distance, resize the kitchen by an exact dimension, and generate a DWG preview plan containing site boundary, walls, room labels, dimensions and ARCHON layer mapping. Ambiguous prompts return target candidates instead of guessing.

The UI exposes this in Layout and Drawings workspaces. Operators can run previews even while another ChangeSet is active, but creating a new Proposed ChangeSet stays blocked until the existing proposal is approved, discarded or committed. Any actual proposal still goes through the existing governed `changesets/propose` route and the ChangeSet bar review/edit/approval controls.

No approved Building Graph mutation, immutable version creation, external sync, APS workitem or DWG execution is performed by this checkpoint.
