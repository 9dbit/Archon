# E8 Command Prompt Center editable operation review

This checkpoint adds an editable operation review step between Command Prompt Center preview and Proposed ChangeSet creation. The operator can inspect the generated operation, change the operation type between `MOVE` and `UPDATE`, select the exact canonical Building Graph target, and edit numeric payload fields before submitting.

The UI now distinguishes generated preview output from reviewed submit payload:
- Generated Operations show what the prompt parser produced.
- Editable Operation Review contains the values that will be submitted.
- Reset to preview restores the parser output.
- Client-side review errors block the Create Proposed ChangeSet button before the governed API call.

The server-side governance boundary remains unchanged. The final submit still calls the existing `changesets/propose` route, which validates canonical targets and payloads, blocks active ChangeSets, and creates only a `NEEDS_REVIEW` ChangeSet. This checkpoint does not approve a ChangeSet, does not mutate the approved Building Graph, and does not execute APS or DWG jobs.
