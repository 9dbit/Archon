import { Router } from "express";
import { z } from "zod";
import {
  briefInputSchema,
  changeSetOperationSchema,
  createAIModelRouter,
  runValidationGate,
  CHANGE_SET_SOURCES,
  DESIGN_LOCK_DOMAINS,
} from "@workspace/domain";
import {
  createProject,
  getProjectDetail,
  listAuditEvents,
  listChangeSets,
  listProjects,
  listVersions,
  proposeChangeSet,
} from "@workspace/engine";

export const projectsRouter = Router();
const aiRouter = createAIModelRouter();

const createProjectSchema = z.object({
  name: z.string().min(1),
  buildingType: z.string().min(1),
  locationText: z.string().optional(),
  actor: z.string().min(1).default("user"),
});

projectsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (e) {
    next(e);
  }
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(await createProject(input));
  } catch (e) {
    next(e);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await getProjectDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(detail);
  } catch (e) {
    next(e);
  }
});

/**
 * Deterministic brief interpretation (Phase 0: mock provider only; no
 * external AI calls regardless of available credentials). Does NOT persist —
 * returns a draft brief + assumptions for the user to review and submit as a
 * ChangeSet.
 */
projectsRouter.post("/:id/interpret-brief", async (req, res, next) => {
  try {
    const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
    const interpretation = await aiRouter.interpretBrief(text);
    const draftChecks = runValidationGate({
      brief: briefInputSchema.parse(interpretation.brief),
      rules: [],
      canonicalObjects: [],
    });
    res.json({ ...interpretation, draftChecks, persisted: false });
  } catch (e) {
    next(e);
  }
});

const proposeSchema = z.object({
  source: z.enum(CHANGE_SET_SOURCES).default("USER"),
  intentSummary: z.string().min(1),
  operations: z.array(changeSetOperationSchema).min(1),
  affectedDomains: z.array(z.enum(DESIGN_LOCK_DOMAINS)).default([]),
  requestedLocks: z.array(z.enum(DESIGN_LOCK_DOMAINS)).optional(),
  createdBy: z.string().min(1).default("user"),
});

projectsRouter.post("/:id/change-sets", async (req, res, next) => {
  try {
    const input = proposeSchema.parse(req.body);
    const cs = await proposeChangeSet({ projectId: req.params.id, ...input });
    res.status(201).json(cs);
  } catch (e) {
    next(e);
  }
});

projectsRouter.get("/:id/change-sets", async (req, res, next) => {
  try {
    res.json(await listChangeSets(req.params.id));
  } catch (e) {
    next(e);
  }
});

projectsRouter.get("/:id/versions", async (req, res, next) => {
  try {
    res.json(await listVersions(req.params.id));
  } catch (e) {
    next(e);
  }
});

projectsRouter.get("/:id/audit-events", async (req, res, next) => {
  try {
    res.json(await listAuditEvents(req.params.id));
  } catch (e) {
    next(e);
  }
});
