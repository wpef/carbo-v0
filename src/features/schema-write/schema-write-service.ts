// Écriture de schéma destination (§13) : crée un champ manquant côté
// destination. Validation locale → appel adaptateur → persistance dans le
// snapshot CURRENT (visible immédiatement) → journal SchemaWriteOperation.

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getAdapter } from "@/features/connectors/registry";
import type { NewFieldDef } from "@/features/connectors/contract";
import { validateNewField } from "./lib/validate-field";

export class SchemaWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaWriteError";
  }
}

export async function createDestinationField(
  planId: string,
  objectApiName: string,
  input: NewFieldDef,
) {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    select: { destinationConnectionId: true },
  });
  if (!plan?.destinationConnectionId) throw new SchemaWriteError("Aucune connexion destination.");
  const connectionId = plan.destinationConnectionId;

  const connection = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new SchemaWriteError("Connexion introuvable.");
  const adapter = getAdapter(connection.adapterType);
  if (!adapter.capabilities.canWriteSchema || !adapter.createField) {
    throw new SchemaWriteError("Ce connecteur ne permet pas l'écriture de schéma.");
  }

  // Objet du snapshot CURRENT + champs existants.
  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side: "DESTINATION", status: "CURRENT" },
    select: { id: true },
  });
  if (!snapshot) throw new SchemaWriteError("Aucun schéma destination récupéré.");
  const object = await db.schemaObject.findFirst({
    where: { snapshotId: snapshot.id, apiName: objectApiName },
    include: { fields: { select: { apiName: true } } },
  });
  if (!object) throw new SchemaWriteError(`Objet destination « ${objectApiName} » introuvable.`);

  const errors = validateNewField(
    input,
    adapter.capabilities.supportedFieldTypes ?? [],
    new Set(object.fields.map((f) => f.apiName)),
  );
  if (errors.length > 0) {
    await logOperation(connectionId, objectApiName, input.apiName, "ERROR", errors.join(" "));
    throw new SchemaWriteError(errors.join(" "));
  }

  let confirmed;
  try {
    confirmed = await adapter.createField(connectionId, objectApiName, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de création du champ";
    await logOperation(connectionId, objectApiName, input.apiName, "ERROR", message);
    throw new SchemaWriteError(message);
  }

  // Persiste le champ confirmé dans le snapshot CURRENT (visible tout de suite).
  await db.objectField.create({
    data: {
      objectId: object.id,
      snapshotId: snapshot.id,
      apiName: confirmed.apiName,
      label: confirmed.label,
      dataType: confirmed.dataType,
      isRequired: confirmed.isRequired,
      isReadOnly: confirmed.isReadOnly,
      isUnique: confirmed.isUnique,
      isAccessible: confirmed.isAccessible,
      picklistValues: confirmed.picklistValues ? JSON.stringify(confirmed.picklistValues) : null,
    },
  });

  await logOperation(connectionId, objectApiName, confirmed.apiName, "SUCCESS", null);
  await logAuditEvent({
    planId,
    action: "SCHEMA_FIELD_CREATED",
    entity: "ObjectField",
    details: { objectApiName, fieldApiName: confirmed.apiName, dataType: confirmed.dataType },
  });
  return confirmed;
}

async function logOperation(
  connectionId: string,
  objectApiName: string,
  fieldApiName: string,
  status: "SUCCESS" | "ERROR",
  errorMessage: string | null,
) {
  await db.schemaWriteOperation
    .create({
      data: { connectionId, operationType: "CREATE_FIELD", objectApiName, fieldApiName, status, errorMessage },
    })
    .catch(() => {}); // best-effort (traçabilité, ne bloque jamais l'opération)
}
