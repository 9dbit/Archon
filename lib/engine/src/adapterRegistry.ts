import { createMockAdapters, type ArchonAdapter } from "@workspace/domain";

/** Singleton registry of Phase 0 mock adapters (in-process, no DB access). */
const adapters = createMockAdapters();

export function listAdapters(): ArchonAdapter[] {
  return adapters;
}

export function getAdapter(id: string): ArchonAdapter | undefined {
  return adapters.find((a) => a.id === id);
}
