import { Router } from "express";
import { z } from "zod";
import {
  changeSetOperationSchema,
  DESIGN_LOCK_DOMAINS,
} from "@workspace/domain";
import {
  annotateCheck,
  approveChangeSet,
  getChangeSet,
  listChecks,
  previewChangeSet,
  rejectChangeSet,
  updateChangeSetOperations,
  validateChangeSet,
} from "@workspace/engine";

export const changeSetsRouter = Router();

changeSetsRouter.get("/:id", async (req, res, next) => {
  try {
    const cs = await getChangeSet(req.params.id);
    const checks = await listChecks(req.params.id);
    res.json({ ...cs, checks });
  } catch (e) {
    next(e);
  }
});

changeSetsRouter.get("/:id/preview", async (req, res, next) => {
  try {
    res.json(await previewChangeSet(req.params.id));
  } catch (e) {
    next(e);
  }
});

const patchSchema = z.object({
  operations: z.array(changeSetOperationSchema).min(1),
  intentSummary: z.string().min(1).optional(),
  affectedDomains: z.array(z.enum(DESIGN_LOCK_DOMAINS)).optional(),
  actor: z.string().min(1).default("user"),
});

changeSetsRouter.patch("/:id", async (req, res, next) => {
  try {
    const input = patchSchema.parse(req.body);
    res.json(
      await updateChangeSetOperations({ changeSetId: req.params.id, ...input }),
    );
  } catch (e) {
    next(e);
  }
});

changeSetsRouter.post("/:id/validate", async (req, res, next) => {
  try {
    const { actor } = z
      .object({ actor: z.string().min(1).default("user") })
      .parse(req.body ?? {});
    res.json(await validateChangeSet(req.params.id, actor));
  } catch (e) {
    next(e);
  }
});

changeSetsRouter.patch("/:id/checks/:checkId", async (req, res, next) => {
  try {
    const input = z
      .object({
        reviewerNote: z.string().optional(),
        waiverReason: z.string().optional(),
        actor: z.string().min(1).default("user"),
      })
      .parse(req.body);
    res.json(await annotateCheck({ checkId: req.params.checkId, ...input }));
  } catch (e) {
    next(e);
  }
});

changeSetsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    const input = z
      .object({
        reviewer: z.string().min(1).default("user"),
        note: z.string().optional(),
      })
      .parse(req.body ?? {});
    res.json(await approveChangeSet({ changeSetId: req.params.id, ...input }));
  } catch (e) {
    next(e);
  }
});

changeSetsRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const input = z
      .object({
        reviewer: z.string().min(1).default("user"),
        note: z.string().optional(),
      })
      .parse(req.body ?? {});
    res.json(await rejectChangeSet({ changeSetId: req.params.id, ...input }));
  } catch (e) {
    next(e);
  }
});
