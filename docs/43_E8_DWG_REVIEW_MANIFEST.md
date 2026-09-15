# E8 DWG review manifest

The review surface now exposes a deterministic layer manifest for the initial CAD test: site boundary, walls, room labels, dimensions, and layer mapping. Each layer is marked MATCHED, REVIEW, or LOCKED for human inspection only.

The manifest is evidence, not approval. It does not create a ChangeSet, mutate the canonical Building Graph, or enable external sync.
