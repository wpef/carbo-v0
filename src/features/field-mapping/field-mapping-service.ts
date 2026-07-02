import { db } from "@/lib/db";
import type { CompatibilityStatus } from "@prisma/client";
import { DEMO_FIELD_MATCH_REGISTRY } from "@/features/connectors/demo-data";

/**
 * Compatibilité de types — version SKELETON, volontairement minimale.
 * La matrice complète 5 états + linkStatus calculé (02-domain-rules règles
 * 1 et 2) sera portée de v4 avec ses tests en tranche verticale dédiée.
 */
const TEXT_TYPES = new Set(["string", "textarea", "email", "phone", "url", "id", "picklist"]);
const NUMBER_TYPES = new Set(["number", "currency", "double", "int"]);
const DATE_TYPES = new Set(["date", "datetime"]);

export function computeCompatibility(sourceType: string, destinationType: string): CompatibilityStatus {
  if (sourceType === destinationType) return "COMPATIBLE";
  const families = [TEXT_TYPES, NUMBER_TYPES, DATE_TYPES];
  const family = families.find((f) => f.has(sourceType));
  if (family?.has(destinationType)) return "WARNING";
  return "INCOMPATIBLE";
}

export async function listFieldMappings(objectMappingId: string) {
  return db.fieldMapping.findMany({
    where: { objectMappingId },
    orderBy: { sourceFieldName: "asc" },
  });
}

export async function createFieldMapping(input: {
  objectMappingId: string;
  sourceFieldName: string;
  destinationFieldName: string;
  sourceFieldType: string;
  destinationFieldType: string;
}) {
  return db.fieldMapping.create({
    data: {
      ...input,
      compatibilityStatus: computeCompatibility(input.sourceFieldType, input.destinationFieldType),
    },
  });
}

export async function deleteFieldMapping(objectMappingId: string, fieldMappingId: string) {
  return db.fieldMapping.deleteMany({ where: { id: fieldMappingId, objectMappingId } });
}

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/__c$/, "").replace(/[_\s]/g, "");
}

/**
 * Auto-match des champs d'une paire : registre ∪ name-based (02-domain-rules
 * règle 4). Principe IX : gated par `objectMapping.fieldAutoMatchedAt`, posé
 * dans la même transaction — no-op {created:0, skipped:true} si déjà fait.
 */
export async function autoMatchFields(
  objectMappingId: string,
  sourceFields: { apiName: string; dataType: string }[],
  destinationFields: { apiName: string; dataType: string }[],
) {
  const mapping = await db.objectMapping.findUnique({ where: { id: objectMappingId } });
  if (!mapping) throw new Error("Mapping d'objets introuvable");
  if (mapping.fieldAutoMatchedAt) {
    return { created: 0, skipped: true as const };
  }

  const registry =
    DEMO_FIELD_MATCH_REGISTRY[`${mapping.sourceObjectName}:${mapping.destinationObjectName}`] ?? {};
  const destByApiName = new Map(destinationFields.map((f) => [f.apiName, f]));
  const destByNormalized = new Map(destinationFields.map((f) => [normalizeFieldName(f.apiName), f]));

  const existing = await db.fieldMapping.findMany({ where: { objectMappingId } });
  const usedSource = new Set(existing.map((m) => m.sourceFieldName));
  const usedDestination = new Set(existing.map((m) => m.destinationFieldName));

  const created = await db.$transaction(async (tx) => {
    let count = 0;
    for (const sourceField of sourceFields) {
      if (usedSource.has(sourceField.apiName)) continue;
      const target =
        destByApiName.get(registry[sourceField.apiName] ?? "") ??
        destByNormalized.get(normalizeFieldName(sourceField.apiName));
      if (!target || usedDestination.has(target.apiName)) continue;
      await tx.fieldMapping.create({
        data: {
          objectMappingId,
          sourceFieldName: sourceField.apiName,
          destinationFieldName: target.apiName,
          sourceFieldType: sourceField.dataType,
          destinationFieldType: target.dataType,
          compatibilityStatus: computeCompatibility(sourceField.dataType, target.dataType),
          autoCreated: true,
        },
      });
      usedDestination.add(target.apiName);
      count++;
    }
    await tx.objectMapping.update({
      where: { id: objectMappingId },
      data: { fieldAutoMatchedAt: new Date() },
    });
    return count;
  });

  return { created, skipped: false as const };
}
