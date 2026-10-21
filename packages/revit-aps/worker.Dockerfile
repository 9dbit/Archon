FROM node:22-bookworm-slim
WORKDIR /app
COPY packages/revit-aps/discovery.mjs packages/revit-aps/worker.mjs ./packages/revit-aps/
ENV ARCHON_REVIT_APS_WORKER_MODE=OFFLINE
USER node
CMD ["node", "packages/revit-aps/worker.mjs"]
