import { db } from "@/lib/db";
import type { CompatibilityStatus } from "@prisma/client";
import { computeFieldMatchPairs } from "@/features/connectors/link-registry";

/**
 * Compatibilité de types — version SKELETON, volontairement minimale.
 * La matrice complète 5 états + linkStatus calculé (02-domain-rules règles
 * 1 et 2) sera portée de v4 avec ses tests en tranche verticale dédiée.
 */
const TEXT_TYPES = new Set(["string", "textarea", "email", "phone", "url", "id", "picklist"]);
const NUMBER_TYPES = new Set(["number", "currency", "decimal", "integer", "percent", "double", "int"]);
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

/**
 * Auto-match des champs d'une paire : registre de la paire d'adaptateurs ∪
 * name-based (02-domain-rules règle 4 — la résolution pure vit dans
 * link-registry.computeFieldMatchPairs). Principe IX : gated par
 * `objectMapping.fieldAutoMatchedAt`, posé dans la même transaction —
 * no-op {created:0, skipped:true} si déjà fait.
 */
export async function autoMatchFields(
  objectMappingId: string,
  sourceFields: { apiName: string; dataType: string }[],
  destinationFields: { apiName: string; dataType: string }[],
) {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      plan: { include: { sourceConnection: true, destinationConnection: true } },
      fieldMappings: { select: { sourceFieldName: true, destinationFieldName: true } },
    },
  });
  if (!mapping) throw new Error("Mapping d'objets introuvable");
  if (mapping.fieldAutoMatchedAt) {
    return { created: 0, skipped: true as const };
  }
  const { sourceConnection, destinationConnection } = mapping.plan;
  if (!sourceConnection || !destinationConnection) {
    throw new Error("Les deux connexions sont requises");
  }

  const pairs = computeFieldMatchPairs(
    sourceConnection.adapterType,
    destinationConnection.adapterType,
    mapping.sourceObjectName,
    mapping.destinationObjectName,
    sourceFields,
    destinationFields,
    mapping.fieldMappings,
  );

  const typeByApiName = new Map([
    ...sourceFields.map((f) => [`s:${f.apiName}`, f.dataType] as const),
    ...destinationFields.map((f) => [`d:${f.apiName}`, f.dataType] as const),
  ]);

  const created = await db.$transaction(async (tx) => {
    for (const pair of pairs) {
      const sourceType = typeByApiName.get(`s:${pair.sourceFieldName}`) ?? "";
      const destinationType = typeByApiName.get(`d:${pair.destinationFieldName}`) ?? "";
      await tx.fieldMapping.create({
        data: {
          objectMappingId,
          sourceFieldName: pair.sourceFieldName,
          destinationFieldName: pair.destinationFieldName,
          sourceFieldType: sourceType,
          destinationFieldType: destinationType,
          compatibilityStatus: computeCompatibility(sourceType, destinationType),
          autoCreated: true,
        },
      });
    }
    await tx.objectMapping.update({
      where: { id: objectMappingId },
      data: { fieldAutoMatchedAt: new Date() },
    });
    return pairs.length;
  });

  return { created, skipped: false as const };
}
