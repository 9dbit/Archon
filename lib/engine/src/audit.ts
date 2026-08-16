import { auditEvents, type Db, type Tx } from "@workspace/db";

export async function recordAudit(
  dbOrTx: Db | Tx,
  event: {
    projectId: string;
    entityType: string;
    entityId: string;
    eventType: string;
    actor: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await dbOrTx.insert(auditEvents).values({
    projectId: event.projectId,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    actor: event.actor,
    payload: event.payload ?? {},
  });
}
