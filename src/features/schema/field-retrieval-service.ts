import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { SnapshotSide } from "@prisma/client";
import { getAdapter } from "@/features/connectors/registry";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import { getSelectedObjectNames } from "./selection-service";

/**
 * Récupération des CHAMPS via l'adaptateur — séparée de la connexion car
 * coûteuse (Salesforce : 1 describe par objet).
 *
 * Portée (01-journeys §4.2) : source = objets SÉLECTIONNÉS uniquement
 * (jamais les 1000+ objets d'une org réelle) ; destination = tous les objets.
 */
export async function retrieveFields(connectionId: string, side: SnapshotSide) {
  const record = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!record) throw new Error("Connexion introuvable");
  const adapter = getAdapter(record.adapterType);

  const snapshot = await getCurrentSnapshot(connectionId, side);
  if (!snapshot) throw new Error("Aucun schéma récupéré — connectez d'abord le système");

  let objects = snapshot.objects;
  if (side === "SOURCE") {
    const selected = new Set(await getSelectedObjectNames(connectionId));
    objects = objects.filter((o) => selected.has(o.apiName));
    if (objects.length === 0) {
      throw new Error("Aucun objet sélectionné — retournez à la sélection d'objets");
    }
  }

  let fieldCount = 0;
  for (const object of objects) {
    const fields = await adapter.getFields(connectionId, object.apiName);
    // Remplacement ATOMIQUE des champs de l'objet (re-retrieve = refresh) :
    // delete + create dans UNE transaction — un échec ne laisse jamais l'objet
    // sans champs (anti-pattern proscrit 05-acceptance §3, Principe III).
    await db.$transaction([
      db.objectField.deleteMany({ where: { objectId: object.id } }),
      db.objectField.createMany({
        data: fields.map((f) => ({
          objectId: object.id,
          snapshotId: snapshot.id,
          apiName: f.apiName,
          label: f.label,
          dataType: f.dataType,
          isRequired: f.isRequired,
          isReadOnly: f.isReadOnly,
          isUnique: f.isUnique,
          // isAccessible peuplé à l'écriture — trou historique n°8 (03-data-model).
          isAccessible: f.isAccessible,
          referenceTo: f.referenceTo ?? null,
          picklistValues: f.picklistValues ? JSON.stringify(f.picklistValues) : null,
        })),
      }),
    ]);
    fieldCount += fields.length;
  }

  await logAuditEvent({
    action: "FIELDS_RETRIEVED",
    entity: "ConnectorConnection",
    entityId: connectionId,
    details: { side, objectCount: objects.length, fieldCount },
  });
  return { objectCount: objects.length, fieldCount };
}

/** Y a-t-il déjà des champs persistés ? (pilote l'auto-retrieve à la première arrivée, §4.2) */
export async function hasRetrievedFields(connectionId: string, side: SnapshotSide): Promise<boolean> {
  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    select: { id: true },
  });
  if (!snapshot) return false;
  const field = await db.objectField.findFirst({
    where: { snapshotId: snapshot.id },
    select: { id: true },
  });
  return field !== null;
}
