// Service de couverture d'une paire (02-domain-rules règle 7) : résout les
// champs des deux côtés sur le snapshot CURRENT, applique les exclusions, et
// délègue le calcul au cœur pur (lib/compute-unmapped). Exclusions = décision
// consultant documentée (reprise à l'Article 4 du document contractuel).

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  computeUnmappedFields,
  type UnmappedFieldsReport,
  type UnmappedInputField,
} from "./lib/compute-unmapped";

export class ObjectMappingNotFoundError extends Error {
  constructor(id: string) {
    super(`Mapping d'objets introuvable : ${id}`);
    this.name = "ObjectMappingNotFoundError";
  }
}

async function resolveFields(
  connectionId: string | null,
  side: "SOURCE" | "DESTINATION",
  objectApiName: string,
): Promise<UnmappedInputField[]> {
  if (!connectionId) return [];
  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    select: { id: true },
  });
  if (!snapshot) return [];
  const object = await db.schemaObject.findFirst({
    where: { snapshotId: snapshot.id, apiName: objectApiName },
    include: {
      fields: {
        select: {
          apiName: true,
          label: true,
          dataType: true,
          isRequired: true,
          isReadOnly: true,
        },
      },
    },
  });
  return object?.fields ?? [];
}

/** Rapport de couverture d'une paire d'objets (résolu sur le snapshot CURRENT). */
export async function getCoverageReport(objectMappingId: string): Promise<UnmappedFieldsReport> {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      plan: { select: { sourceConnectionId: true, destinationConnectionId: true } },
      fieldMappings: { select: { sourceFieldName: true, destinationFieldName: true } },
      exclusions: { select: { id: true, sourceFieldName: true, reason: true } },
    },
  });
  if (!mapping) throw new ObjectMappingNotFoundError(objectMappingId);

  const [sourceFields, destFields] = await Promise.all([
    resolveFields(mapping.plan.sourceConnectionId, "SOURCE", mapping.sourceObjectName),
    resolveFields(mapping.plan.destinationConnectionId, "DESTINATION", mapping.destinationObjectName),
  ]);

  return computeUnmappedFields(
    sourceFields,
    destFields,
    mapping.fieldMappings,
    mapping.exclusions,
  );
}

/** Exclut un champ source du périmètre (décision documentée, réversible). */
export async function addExclusion(
  objectMappingId: string,
  sourceFieldName: string,
  reason: string | null,
) {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    select: { planId: true },
  });
  if (!mapping) throw new ObjectMappingNotFoundError(objectMappingId);

  const exclusion = await db.fieldExclusion.upsert({
    where: { objectMappingId_sourceFieldName: { objectMappingId, sourceFieldName } },
    create: { objectMappingId, sourceFieldName, reason },
    update: { reason },
  });
  await logAuditEvent({
    planId: mapping.planId,
    action: "FIELD_EXCLUDED",
    entity: "FieldExclusion",
    entityId: exclusion.id,
    details: { objectMappingId, sourceFieldName, reason },
  });
  return exclusion;
}

/** Réintègre un champ source précédemment exclu. */
export async function removeExclusion(objectMappingId: string, sourceFieldName: string) {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    select: { planId: true },
  });
  if (!mapping) throw new ObjectMappingNotFoundError(objectMappingId);

  await db.fieldExclusion.deleteMany({ where: { objectMappingId, sourceFieldName } });
  await logAuditEvent({
    planId: mapping.planId,
    action: "FIELD_UNEXCLUDED",
    entity: "FieldExclusion",
    details: { objectMappingId, sourceFieldName },
  });
}
