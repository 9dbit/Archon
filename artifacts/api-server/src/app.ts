import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { ZodError } from "zod";
import { EngineError } from "@workspace/engine";
import { adaptersRouter } from "./routes/adapters";
import { canvasRouter } from "./routes/canvas";
import { changeSetsRouter } from "./routes/changeSets";
import { projectsRouter } from "./routes/projects";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "archon-api", phase: "phase-0" });
  });

  app.use("/api/projects", projectsRouter);
  app.use("/api/change-sets", changeSetsRouter);
  app.use("/api", canvasRouter);
  app.use("/api/adapters", adaptersRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Validation failed", issues: err.issues });
      return;
    }
    if (err instanceof EngineError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
