import { Router } from "express";
import { z } from "zod";
import {
  getAdapter,
  getApprovedSnapshot,
  listAdapters,
} from "@workspace/engine";

export const adaptersRouter = Router();

adaptersRouter.get("/", async (_req, res, next) => {
  try {
    const adapters = await Promise.all(
      listAdapters().map(async (a) => ({
        id: a.id,
        name: a.name,
        version: a.version,
        health: await a.health(),
        capabilities: await a.capabilities(),
        failureMode: a.failureMode,
      })),
    );
    res.json(adapters);
  } catch (e) {
    next(e);
  }
});

/**
 * Simulated sync of an approved project snapshot. The adapter receives a
 * deep copy and has no DB access; failure mode returns a controlled error and
 * never corrupts canonical state.
 */
adaptersRouter.post("/:id/simulate", async (req, res, next) => {
  try {
    const adapter = getAdapter(req.params.id);
    if (!adapter) {
      res.status(404).json({ error: "Adapter not found" });
      return;
    }
    const input = z
      .object({
        projectId: z.string().uuid(),
        mode: z.enum(["sync", "failure"]).default("sync"),
      })
      .parse(req.body);

    adapter.setFailureMode(input.mode === "failure");
    try {
      const { snapshot } = await getApprovedSnapshot(input.projectId);
      const result = await adapter.syncSnapshot(structuredClone(snapshot));
      const reconciliation = await adapter.reconcile(structuredClone(snapshot));
      res.status(result.ok ? 200 : 502).json({ result, reconciliation });
    } finally {
      adapter.setFailureMode(false);
    }
  } catch (e) {
    next(e);
  }
});
