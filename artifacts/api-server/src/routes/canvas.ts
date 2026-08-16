import { Router } from "express";
import { z } from "zod";
import {
  canvasArtifactInputSchema,
  changeSetOperationSchema,
  DESIGN_LOCK_DOMAINS,
} from "@workspace/domain";
import {
  createCanvasArtifact,
  listCanvasArtifacts,
  promoteCanvasArtifact,
} from "@workspace/engine";

export const canvasRouter = Router();

canvasRouter.get("/projects/:id/canvas-artifacts", async (req, res, next) => {
  try {
    res.json(await listCanvasArtifacts(req.params.id));
  } catch (e) {
    next(e);
  }
});

canvasRouter.post("/projects/:id/canvas-artifacts", async (req, res, next) => {
  try {
    const artifact = canvasArtifactInputSchema.parse(
      req.body.artifact ?? req.body,
    );
    const actor = z
      .string()
      .min(1)
      .default("user")
      .parse(req.body.actor ?? "user");
    res.status(201).json(
      await createCanvasArtifact({
        projectId: req.params.id,
        artifact,
        actor,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Promotion creates a Proposed ChangeSet only; it never mutates approved
 * canonical state directly (Issue #4 adjustment 4).
 */
canvasRouter.post("/canvas-artifacts/:id/promote", async (req, res, next) => {
  try {
    const input = z
      .object({
        operations: z.array(changeSetOperationSchema).min(1),
        intentSummary: z.string().optional(),
        affectedDomains: z.array(z.enum(DESIGN_LOCK_DOMAINS)).optional(),
        actor: z.string().min(1).default("user"),
      })
      .parse(req.body);
    res
      .status(201)
      .json(
        await promoteCanvasArtifact({ artifactId: req.params.id, ...input }),
      );
  } catch (e) {
    next(e);
  }
});
