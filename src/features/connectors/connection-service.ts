import { db } from "@/lib/db";
import type { SnapshotSide } from "@prisma/client";
import { DEMO_DESTINATION_OBJECTS, DEMO_SOURCE_OBJECTS } from "./demo-data";

/**
 * Connexion d'un adaptateur à un plan + récupération immédiate du schéma.
 *
 * Garantie de parcours (01-journeys §4.1) : une connexion n'existe jamais
 * sans snapshot CURRENT — la récupération du schéma n'est pas une étape
 * manuelle zappable. Pour le connecteur démo, elle est faite dans la même
 * requête ; les adaptateurs OAuth (Phase 2) la feront au retour du callback.
 */
export async function connectDemo(planId: string, side: SnapshotSide) {
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan introuvable");

  const existingId = side === "SOURCE" ? plan.sourceConnectionId : plan.destinationConnectionId;
  if (existingId) throw new Error(`Une connexion ${side.toLowerCase()} existe déjà`);

  const connection = await db.connectorConnection.create({
    data: {
      adapterType: "demo",
      name: side === "SOURCE" ? "CRM démo (source)" : "CRM démo (destination)",
    },
  });

  await db.migrationPlan.update({
    where: { id: planId },
    data:
      side === "SOURCE"
        ? { sourceConnectionId: connection.id }
        : { destinationConnectionId: connection.id },
  });

  const snapshot = await fetchSchema(connection.id, side);
  return { connection, snapshot };
}

/** Fetch adaptateur → snapshot CURRENT + objets + champs persistés. */
export async function fetchSchema(connectionId: string, side: SnapshotSide) {
  const connection = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error("Connexion introuvable");
  if (connection.adapterType !== "demo") {
    throw new Error(`Adaptateur non supporté dans le skeleton : ${connection.adapterType}`);
  }

  const demoObjects = side === "SOURCE" ? DEMO_SOURCE_OBJECTS : DEMO_DESTINATION_OBJECTS;

  // Skeleton : pas encore de rotation CURRENT→PREVIOUS (viendra avec le
  // drift, Phase 2) — on remplace le snapshot CURRENT s'il existe.
  await db.schemaSnapshot.deleteMany({ where: { connectionId, side, status: "CURRENT" } });

  const snapshot = await db.schemaSnapshot.create({
    data: { connectionId, side },
  });

  for (const obj of demoObjects) {
    await db.schemaObject.create({
      data: {
        snapshotId: snapshot.id,
        apiName: obj.apiName,
        label: obj.label,
        description: obj.description ?? null,
        isCustom: obj.isCustom ?? false,
        fields: {
          create: obj.fields.map((f) => ({
            snapshotId: snapshot.id,
            apiName: f.apiName,
            label: f.label,
            dataType: f.dataType,
            isRequired: f.isRequired ?? false,
            // isAccessible peuplé à l'écriture — trou historique n°8
            // (03-data-model §Trous historiques) : jamais de valeur implicite.
            isAccessible: true,
            picklistValues: f.picklistValues ? JSON.stringify(f.picklistValues) : null,
          })),
        },
      },
    });
  }

  return db.schemaSnapshot.findUniqueOrThrow({
    where: { id: snapshot.id },
    include: { objects: { include: { fields: true } } },
  });
}

export async function getCurrentSnapshot(connectionId: string, side: SnapshotSide) {
  return db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    include: { objects: { orderBy: { apiName: "asc" }, include: { fields: true } } },
  });
}
