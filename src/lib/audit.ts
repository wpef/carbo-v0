import { db } from "@/lib/db";

/**
 * Trace d'audit (Principe VI : traçabilité par défaut). Best-effort : un
 * échec d'audit ne doit jamais faire échouer l'opération métier.
 */
export async function logAuditEvent(event: {
  planId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        planId: event.planId ?? null,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        details: JSON.stringify(event.details ?? {}),
      },
    });
  } catch (error) {
    console.warn("[audit] échec d'écriture:", error);
  }
}
