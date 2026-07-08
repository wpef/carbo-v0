// Aperçu des enregistrements (02-domain-rules règle 10) — porté de v4.
// Pagination 1-indexée via adapter.getRecords ; sanitisation des valeurs
// binaires (placeholder "[binary data]", jamais de dump binaire au client) ;
// audit RECORDS_PREVIEWED.

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getAdapter } from "@/features/connectors/registry";
import type { PaginatedRecords } from "@/features/connectors/contract";

export class RecordPreviewUnsupportedError extends Error {
  constructor(adapterType: string) {
    super(`L'aperçu des enregistrements n'est pas disponible pour le connecteur « ${adapterType} ».`);
    this.name = "RecordPreviewUnsupportedError";
  }
}

export class RecordPreviewUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordPreviewUnavailableError";
  }
}

async function resolveConnection(planId: string, side: "SOURCE" | "DESTINATION") {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  });
  if (!plan) throw new RecordPreviewUnavailableError(`Plan introuvable : ${planId}`);
  const conn = side === "SOURCE" ? plan.sourceConnection : plan.destinationConnection;
  if (!conn) {
    throw new RecordPreviewUnavailableError(
      `Aucune connexion ${side === "SOURCE" ? "source" : "destination"} sur ce plan.`,
    );
  }
  if (conn.status !== "CONNECTED") {
    throw new RecordPreviewUnavailableError(`La connexion ${conn.name} n'est pas active.`);
  }
  return conn;
}

/** Remplace Buffer/Uint8Array par "[binary data]" (jamais de perte silencieuse : le placeholder EST l'information). */
function sanitiseBinary(records: Record<string, unknown>[]): Record<string, unknown>[] {
  return records.map((record) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] =
        v instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(v))
          ? "[binary data]"
          : v;
    }
    return out;
  });
}

/** Page d'enregistrements (défaut 50), binaire sanitisé, audité. */
export async function fetchRecordPage(
  planId: string,
  side: "SOURCE" | "DESTINATION",
  objectApiName: string,
  page: number,
  pageSize: number = 50,
): Promise<PaginatedRecords> {
  const conn = await resolveConnection(planId, side);
  const adapter = getAdapter(conn.adapterType);
  if (!adapter.getRecords) throw new RecordPreviewUnsupportedError(conn.adapterType);

  const result = await adapter.getRecords(conn.id, objectApiName, page, pageSize);
  const records = sanitiseBinary(result.records);

  await logAuditEvent({
    planId,
    action: "RECORDS_PREVIEWED",
    entity: "ConnectorConnection",
    entityId: conn.id,
    details: { side, objectApiName, page, pageSize, count: records.length },
  });

  return { ...result, records };
}
