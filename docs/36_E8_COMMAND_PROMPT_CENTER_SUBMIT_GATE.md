# E8 Command Prompt Center governed submit UX

This checkpoint clarifies the submit boundary for Command Prompt Center. The UI now renders a Governed Submit Gate below every prompt session so operators can see why a command is pending, locked, blocked, or ready before any proposal can be created.

The gate follows the ARCHON governance sequence:
- Intent
- Preview
- Validation
- Review/Edit
- Approval

A raw prompt cannot create a proposal directly. The operator must run sandbox preview first. Ambiguous target prompts must be resolved to a canonical Building Graph target. Drawing-only DWG prompts remain locked because they do not contain graph operations. If another ChangeSet is active, the gate points the operator to the active ChangeSet bar, where the existing governed actions remain available: Preview Changes, Rebase, Edit, Approve, and Discard.

This checkpoint does not add any production auto-resolution behavior. It does not mutate the approved Building Graph, does not approve a ChangeSet automatically, and does not execute APS or DWG jobs.
