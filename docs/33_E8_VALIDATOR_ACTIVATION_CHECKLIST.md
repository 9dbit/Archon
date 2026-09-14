# E8 scoped validator resource apply plan and activation checklist

ARCHON now exposes a non-secret, read-only validator activation plan at `GET /api/integrations/autocad/sandbox/validator/activation`. The response is an operator checklist only: it reads environment readiness, derives the expected `ArchonValidateDrawing+v0_1` resource IDs, reports temporary gate state, and confirms that execution, approval, production ChangeSets and Building Graph mutation remain disabled.

The scoped APS resource apply plan targets only the validator Activity and alias. Its allowed operation sequence is namespace read, AutoCAD engine verification, existing layout bundle alias verification, validator-activity absence check, Activity creation, alias creation and readback verification. Workitem submission, DWG writes, approved graph mutation and production ChangeSet approval are explicitly out of scope.

The command prompt center can be tried next in sandbox-preview mode: prompt to Intent, Proposed ChangeSet, preview/diff, validation checklist and review. That mode does not require APS execution. A real CAD roundtrip remains blocked until the validator resource is configured, the durable validator receipt key exists, endpoint and finalization gates are opened only for a short reviewed window, the transport gate is opened, and explicit operator approval is granted for a single governed execution.

No real APS validator workitem is executed by this checkpoint, and no approved Building Graph or production ChangeSet is mutated.
