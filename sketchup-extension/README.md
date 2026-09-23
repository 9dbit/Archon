# ARCHON for SketchUp

First v2 bridge slice for ARCHON. This version is intentionally **read-only** with respect to SketchUp geometry.

## What this slice does

- opens an ARCHON panel inside SketchUp;
- stores the ARCHON base URL, bridge token, and optional project ID in local SketchUp preferences;
- analyzes the active model;
- captures model GUID, bounds, tags, materials, scenes, definitions, root entities, stable persistent IDs where available, and ARCHON attribute dictionaries;
- computes a deterministic semantic hash that ignores analysis timestamp;
- sends the manifest to the ARCHON cloud endpoint;
- receives a receipt/hash response.

## What this slice does not do

- create or edit geometry;
- write ARCHON IDs back to SketchUp entities;
- generate scenes or section planes;
- create or overwrite LayOut documents;
- approve or execute ChangeSets;
- publish DWG/PDF.

Those capabilities remain locked until later governed phases.

## Install from CI artifact

GitHub Actions packages `ARCHON.rbz` as the `ARCHON-SketchUp-RBZ` artifact.

In SketchUp:

1. Open **Extension Manager**.
2. Choose **Install Extension**.
3. Select `ARCHON.rbz`.
4. Restart SketchUp if requested.
5. Open **Extensions → ARCHON**.

## Connection configuration

Set:

- **ARCHON URL** — Railway/public URL for the ARCHON web service.
- **Bridge token** — raw client token stored only in local SketchUp preferences.
- **Project ID** — optional during the first bridge slice.

On the server, store only `SHA-256(bridge token)` as `ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256`. The raw bridge token must not be stored as a Railway server variable and is never included in the model manifest.

## Smoke test

1. Open a real `.skp` file.
2. Open ARCHON.
3. Click **Analyze Current Model**.
4. Confirm entity, face, material, and scene counts are shown.
5. Note the semantic hash.
6. Click **Analyze Current Model** again without changing the model.
7. Confirm the semantic hash is unchanged.
8. Click **Send Manifest**.
9. Confirm the server returns `accepted: true`, a `receiptId`, a `payloadSha256`, and `mutation: "none"`.
10. Confirm model geometry has not changed.

## Security note

The first endpoint uses one bearer credential but stores only its SHA-256 digest server-side. Before broad distribution, move to per-device credentials with revocation/rotation and bind each device to a user/project authorization scope.
