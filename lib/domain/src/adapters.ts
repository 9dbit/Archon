import type { CanonicalSnapshot, ChangeSetOperation } from "./types";

/**
 * Adapter boundary (docs/02, docs/05 §9). External CAD/BIM software is only
 * reached through this contract. Phase 0 ships in-process mocks only.
 * A failed adapter must never corrupt approved canonical state — adapters
 * receive read-only copies and have no database access.
 */

export interface AdapterHealth {
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  detail: string;
}

export interface AdapterCapabilities {
  import: string[];
  export: string[];
  livePreview: boolean;
  bidirectionalSync: boolean;
}

export interface AdapterSyncResult {
  ok: boolean;
  syncedObjects: number;
  externalRevision: string | null;
  error: string | null;
}

export interface AdapterReconciliationReport {
  inSync: boolean;
  drift: string[];
}

export interface ArchonAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  health(): Promise<AdapterHealth>;
  capabilities(): Promise<AdapterCapabilities>;
  previewOperations(ops: ChangeSetOperation[]): Promise<string>;
  validateOperations(ops: ChangeSetOperation[]): Promise<string[]>;
  /** Simulated push of an approved snapshot. Receives a deep copy; read-only. */
  syncSnapshot(snapshot: CanonicalSnapshot): Promise<AdapterSyncResult>;
  reconcile(snapshot: CanonicalSnapshot): Promise<AdapterReconciliationReport>;
  setFailureMode(enabled: boolean): void;
  failureMode: boolean;
}

class MockAdapter implements ArchonAdapter {
  failureMode = false;
  private syncCounter = 0;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly version: string,
    private readonly caps: AdapterCapabilities,
  ) {}

  setFailureMode(enabled: boolean): void {
    this.failureMode = enabled;
  }

  health(): Promise<AdapterHealth> {
    return Promise.resolve(
      this.failureMode
        ? {
            status: "down",
            latencyMs: 2500,
            detail: `${this.name} mock is in simulated failure mode.`,
          }
        : {
            status: "ok",
            latencyMs: 12,
            detail: `${this.name} mock responding normally.`,
          },
    );
  }

  capabilities(): Promise<AdapterCapabilities> {
    return Promise.resolve({ ...this.caps });
  }

  previewOperations(ops: ChangeSetOperation[]): Promise<string> {
    if (this.failureMode)
      return Promise.reject(
        new Error(`${this.name} adapter unavailable (simulated).`),
      );
    return Promise.resolve(
      `${this.name} preview: ${ops.length} operation(s) renderable.`,
    );
  }

  validateOperations(ops: ChangeSetOperation[]): Promise<string[]> {
    if (this.failureMode)
      return Promise.reject(
        new Error(`${this.name} adapter unavailable (simulated).`),
      );
    return Promise.resolve(
      ops.map((op) => `${this.name}: ${op.type} accepted`),
    );
  }

  syncSnapshot(snapshot: CanonicalSnapshot): Promise<AdapterSyncResult> {
    if (this.failureMode) {
      // Controlled failure: reject WITHOUT touching the snapshot.
      return Promise.resolve({
        ok: false,
        syncedObjects: 0,
        externalRevision: null,
        error: `${this.name} sync failed (simulated failure mode). Canonical state untouched.`,
      });
    }
    this.syncCounter += 1;
    return Promise.resolve({
      ok: true,
      syncedObjects: snapshot.canonicalObjects.length,
      externalRevision: `${this.id}-rev-${this.syncCounter}`,
      error: null,
    });
  }

  reconcile(snapshot: CanonicalSnapshot): Promise<AdapterReconciliationReport> {
    if (this.failureMode) {
      return Promise.resolve({
        inSync: false,
        drift: [
          `${this.name} unreachable (simulated); last known state may drift.`,
        ],
      });
    }
    return Promise.resolve({
      inSync: true,
      drift:
        snapshot.canonicalObjects.length === 0
          ? ["No canonical objects to compare."]
          : [],
    });
  }
}

export function createMockAdapters(): ArchonAdapter[] {
  return [
    new MockAdapter("sketchup-mock", "SketchUp", "0.1.0-mock", {
      import: ["skp"],
      export: ["skp", "png"],
      livePreview: true,
      bidirectionalSync: false,
    }),
    new MockAdapter("revit-mock", "Revit", "0.1.0-mock", {
      import: ["rvt", "ifc"],
      export: ["rvt", "ifc", "pdf"],
      livePreview: false,
      bidirectionalSync: true,
    }),
    new MockAdapter("autocad-mock", "AutoCAD", "0.1.0-mock", {
      import: ["dwg", "dxf"],
      export: ["dwg", "dxf", "pdf"],
      livePreview: false,
      bidirectionalSync: false,
    }),
  ];
}
