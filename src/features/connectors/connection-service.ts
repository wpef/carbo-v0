import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { ConnectorConnection, SnapshotSide } from "@prisma/client";
import { getAdapter } from "./registry";
import { classifyConnectionError } from "./connection-status";

/**
 * Cycle de vie d'une connexion, générique pour tous les adaptateurs.
 *
 * Garantie de parcours (01-journeys §4.1) : une connexion n'existe jamais
 * sans snapshot CURRENT — le schéma (les OBJETS, pas les champs) est
 * récupéré dans la foulée de la création. Les champs, coûteux (1 describe
 * par objet côté Salesforce), sont récupérés séparément et scopés à la
 * sélection : field-retrieval-service.
 */

/** Crée la connexion, la lie au plan, récupère le schéma. Refuse le doublon. */
export async function createConnection(input: {
  planId: string;
  side: SnapshotSide;
  adapterType: string;
  name: string;
  config?: Record<string, unknown>;
}): Promise<ConnectorConnection> {
  getAdapter(input.adapterType); // valide le type avant d'écrire quoi que ce soit

  const plan = await db.migrationPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error("Plan introuvable");
  const existingId = input.side === "SOURCE" ? plan.sourceConnectionId : plan.destinationConnectionId;
  if (existingId) throw new Error(`Une connexion ${input.side.toLowerCase()} existe déjà`);

  const connection = await db.connectorConnection.create({
    data: {
      adapterType: input.adapterType,
      name: input.name,
      config: JSON.stringify(input.config ?? {}),
    },
  });
  await linkConnectionToPlan(input.planId, input.side, connection.id);
  await fetchSchema(connection.id, input.side);

  await logAuditEvent({
    planId: input.planId,
    action: "CONNECTION_CREATED",
    entity: "ConnectorConnection",
    entityId: connection.id,
    details: { adapterType: input.adapterType, side: input.side },
  });
  return connection;
}

/**
 * Rattache une connexion existante au plan (utilisé par les callbacks OAuth,
 * qui créent la connexion avant de connaître ce helper). Remplace l'ancienne
 * connexion du même côté si elle existe.
 */
export async function linkConnectionToPlan(
  planId: string,
  side: SnapshotSide,
  connectionId: string,
): Promise<void> {
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan introuvable");

  const previousId = side === "SOURCE" ? plan.sourceConnectionId : plan.destinationConnectionId;
  await db.migrationPlan.update({
    where: { id: planId },
    data: side === "SOURCE" ? { sourceConnectionId: connectionId } : { destinationConnectionId: connectionId },
  });
  if (previousId && previousId !== connectionId) {
    await cleanupConnection(previousId);
  }
}

/**
 * Fetch adaptateur → snapshot CURRENT + objets persistés (SANS les champs).
 * Remplace le snapshot CURRENT. Au refresh, la SÉLECTION d'objets existante
 * est REPORTÉE sur le nouveau snapshot (migrateSelection, 05-acceptance §2) :
 * un refresh ne désélectionne jamais silencieusement (Principe III). La
 * rotation CURRENT→PREVIOUS (drift) arrive avec sa tranche.
 */
export async function fetchSchema(connectionId: string, side: SnapshotSide) {
  const record = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!record) throw new Error("Connexion introuvable");
  const adapter = getAdapter(record.adapterType);

  // Appel réseau HORS transaction (ne jamais tenir un verrou DB pendant un I/O).
  // Une panne (token expiré, org injoignable) marque la connexion EXPIRED/ERROR
  // — statut visible partout (05-acceptance §1/§5), jamais un échec muet.
  let objects;
  try {
    objects = await adapter.getObjects(connectionId);
  } catch (err) {
    await db.connectorConnection.update({
      where: { id: connectionId },
      data: { status: classifyConnectionError(err) },
    });
    throw err;
  }

  // Sélection à migrer (concept SOURCE) — LECTURE hors transaction (pas de
  // round-trip inutile sous verrou). Capturée avant la rotation ; une légère
  // course avec un refresh concurrent ne fait au pire que reporter un état à
  // un instant proche — jamais de perte de snapshot (garanti par la tx).
  let priorSelection: Map<string, boolean> | null = null;
  let oldSelectionSnapshotId: string | null = null;
  if (side === "SOURCE") {
    const oldSnapshot = await db.schemaSnapshot.findFirst({
      where: { connectionId, side, status: "CURRENT" },
      select: { id: true },
    });
    if (oldSnapshot) {
      oldSelectionSnapshotId = oldSnapshot.id;
      const rows = await db.objectSelection.findMany({
        where: { connectionId, snapshotId: oldSnapshot.id },
        select: { objectApiName: true, isSelected: true },
      });
      if (rows.length > 0) priorSelection = new Map(rows.map((r) => [r.objectApiName, r.isSelected]));
    }
  }
  const carried = priorSelection
    ? objects.filter((o) => priorSelection!.has(o.apiName))
    : [];

  // Rotation ATOMIQUE (écritures seulement) : la contrainte
  // @@unique([connectionId, side, status]) interdit deux snapshots CURRENT ;
  // sans transaction, deux refresh concurrents (bouton + filet auto-fetch) se
  // courent dessus — l'un supprime, l'autre viole la contrainte → connexion
  // sans schéma. La transaction sérialise et rollback : l'ancien snapshot
  // survit à tout échec.
  const snapshotId = await db.$transaction(async (tx) => {
    // ObjectSelection n'a pas de cascade FK : nettoyage explicite des orphelines.
    if (oldSelectionSnapshotId) {
      await tx.objectSelection.deleteMany({
        where: { connectionId, snapshotId: oldSelectionSnapshotId },
      });
    }
    await tx.schemaSnapshot.deleteMany({ where: { connectionId, side, status: "CURRENT" } });
    const snapshot = await tx.schemaSnapshot.create({ data: { connectionId, side } });
    // createMany : une org SF réelle expose 1000+ objets — pas d'insertions unitaires.
    await tx.schemaObject.createMany({
      data: objects.map((o) => ({
        snapshotId: snapshot.id,
        apiName: o.apiName,
        label: o.label,
        description: o.description ?? null,
        isCustom: o.isCustom,
      })),
    });
    // migrateSelection : reporte les choix manuels (par apiName) sur le nouveau
    // snapshot, pour les objets qui existent encore.
    if (carried.length > 0) {
      await tx.objectSelection.createMany({
        data: carried.map((o) => ({
          connectionId,
          snapshotId: snapshot.id,
          objectApiName: o.apiName,
          isSelected: priorSelection!.get(o.apiName)!,
        })),
        skipDuplicates: true,
      });
    }
    return snapshot.id;
  });

  // Schéma récupéré → la connexion est saine (efface un EXPIRED/ERROR précédent).
  await db.connectorConnection.update({
    where: { id: connectionId },
    data: { status: "CONNECTED" },
  });

  return db.schemaSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    include: { objects: true },
  });
}

/** Déconnecte un côté du plan : délie + supprime connexion, snapshots (cascade) et sélections. */
export async function disconnect(planId: string, side: SnapshotSide): Promise<void> {
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan introuvable");
  const connectionId = side === "SOURCE" ? plan.sourceConnectionId : plan.destinationConnectionId;
  if (!connectionId) return;

  await db.migrationPlan.update({
    where: { id: planId },
    data: side === "SOURCE" ? { sourceConnectionId: null } : { destinationConnectionId: null },
  });
  await cleanupConnection(connectionId);
  await logAuditEvent({
    planId,
    action: "CONNECTION_REMOVED",
    entity: "ConnectorConnection",
    entityId: connectionId,
    details: { side },
  });
}

/** ObjectSelection n'a pas de FK Prisma (03-data-model) : nettoyage explicite. */
async function cleanupConnection(connectionId: string): Promise<void> {
  await db.objectSelection.deleteMany({ where: { connectionId } });
  await db.connectorConnection.delete({ where: { id: connectionId } }).catch(() => {});
}

export async function getCurrentSnapshot(connectionId: string, side: SnapshotSide) {
  return db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    include: { objects: { orderBy: { apiName: "asc" }, include: { fields: true } } },
  });
}
