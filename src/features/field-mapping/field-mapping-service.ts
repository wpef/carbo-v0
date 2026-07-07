import { db } from "@/lib/db";
import type { CompatibilityStatus, LogicStatus } from "@prisma/client";
import { computeFieldMatchPairs } from "@/features/connectors/link-registry";
import { checkTypeCompatibility } from "./lib/type-compatibility";
import { computeLinkStatus } from "./lib/link-status";
import type { LinkStatus, MigrationLogicSnapshot } from "./lib/link-status";

// ─── DTO ───────────────────────────────────────────────────────────────────────

export interface FieldMappingDTO {
  id: string;
  objectMappingId: string;
  sourceFieldName: string;
  sourceFieldLabel: string;
  sourceFieldType: string;
  destinationFieldName: string;
  destinationFieldLabel: string;
  destinationFieldType: string;
  compatibilityStatus: CompatibilityStatus;
  linkStatus: LinkStatus;
  statusDetail?: string;
  migrationLogic: {
    id: string;
    status: LogicStatus;
    sectionType: string;
    valueEquivalences: { sourceValue: string; destinationValue: string }[];
  } | null;
  autoCreated: boolean;
}

// ─── Résolution anti-stale-FK ──────────────────────────────────────────────────

/**
 * Résout l'objet du snapshot CURRENT pour un plan + side + apiName. Les FK
 * stockées ne sont que des indices : on re-résout toujours par apiName pour
 * survivre aux refreshs de schéma (02-domain-rules, principe transversal).
 */
async function resolveCurrentObject(
  planId: string,
  side: "SOURCE" | "DESTINATION",
  objectApiName: string,
) {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  });
  if (!plan) return null;
  const connectionId = side === "SOURCE" ? plan.sourceConnectionId : plan.destinationConnectionId;
  if (!connectionId) return null;

  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    select: { id: true },
  });
  if (!snapshot) return null;

  return db.schemaObject.findFirst({
    where: { snapshotId: snapshot.id, apiName: objectApiName },
  });
}

function parsePicklistValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Instantané de logique pour computeLinkStatus (complétude D1) : DRAFT →
 * statut seul ; DEFINED/VALIDATED → picklists + valeurs source déjà mappées.
 */
function buildLogicSnapshot(
  logic: {
    status: LogicStatus;
    valueEquivalences: { sourceValue: string; destinationValue: string }[];
  } | null,
  sourcePicklistValues: string[],
  destPicklistValues: string[],
): MigrationLogicSnapshot | null {
  if (!logic) return null;
  if (logic.status === "DRAFT") return { status: "DRAFT" };
  return {
    status: logic.status,
    sourceValues: sourcePicklistValues,
    destValues: destPicklistValues,
    mappedSourceValues: logic.valueEquivalences.map((ve) => ve.sourceValue),
  };
}

function extractSectionType(config: string): string {
  try {
    const parsed = JSON.parse(config) as { sectionType?: string };
    if (parsed.sectionType) return parsed.sectionType;
  } catch {
    // config illisible → fallback
  }
  return "INFORMATIONAL";
}

type DbFieldMapping = {
  id: string;
  objectMappingId: string;
  sourceFieldName: string;
  sourceFieldType: string;
  destinationFieldName: string;
  destinationFieldType: string;
  compatibilityStatus: CompatibilityStatus;
  autoCreated: boolean;
  migrationLogic: {
    id: string;
    status: LogicStatus;
    config: string;
    valueEquivalences: { sourceValue: string; destinationValue: string }[];
  } | null;
};

type DbField = { label: string; dataType: string; picklistValues: string | null };

function toDTO(
  mapping: DbFieldMapping,
  sourceField: DbField | null,
  destField: DbField | null,
): FieldMappingDTO {
  // Types du snapshot CURRENT, fallback types stockés à la création du mapping.
  const srcType = sourceField?.dataType ?? mapping.sourceFieldType;
  const dstType = destField?.dataType ?? mapping.destinationFieldType;

  const srcPicklist = parsePicklistValues(sourceField?.picklistValues);
  const dstPicklist = parsePicklistValues(destField?.picklistValues);

  const logicSnapshot = buildLogicSnapshot(mapping.migrationLogic, srcPicklist, dstPicklist);
  const { linkStatus, statusDetail } = computeLinkStatus(
    srcType,
    dstType,
    logicSnapshot,
    sourceField !== null,
    destField !== null,
  );

  return {
    id: mapping.id,
    objectMappingId: mapping.objectMappingId,
    sourceFieldName: mapping.sourceFieldName,
    sourceFieldLabel: sourceField?.label ?? mapping.sourceFieldName,
    sourceFieldType: srcType,
    destinationFieldName: mapping.destinationFieldName,
    destinationFieldLabel: destField?.label ?? mapping.destinationFieldName,
    destinationFieldType: dstType,
    compatibilityStatus: mapping.compatibilityStatus,
    linkStatus,
    statusDetail,
    migrationLogic: mapping.migrationLogic
      ? {
          id: mapping.migrationLogic.id,
          status: mapping.migrationLogic.status,
          sectionType: extractSectionType(mapping.migrationLogic.config),
          valueEquivalences: mapping.migrationLogic.valueEquivalences,
        }
      : null,
    autoCreated: mapping.autoCreated,
  };
}

// ─── listFieldMappings ─────────────────────────────────────────────────────────

/**
 * Mappings d'une paire, enrichis du linkStatus. Les champs sont résolus par
 * apiName sur le snapshot CURRENT (jamais par FK) : un champ disparu après
 * refresh → linkStatus BROKEN, jamais un rendu cassé.
 */
export async function listFieldMappings(objectMappingId: string): Promise<FieldMappingDTO[]> {
  const objectMapping = await db.objectMapping.findUnique({ where: { id: objectMappingId } });
  if (!objectMapping) return [];

  const mappings = await db.fieldMapping.findMany({
    where: { objectMappingId },
    include: { migrationLogic: { include: { valueEquivalences: true } } },
    orderBy: { sourceFieldName: "asc" },
  });
  if (mappings.length === 0) return [];

  const [currentSourceObj, currentDestObj] = await Promise.all([
    resolveCurrentObject(objectMapping.planId, "SOURCE", objectMapping.sourceObjectName),
    resolveCurrentObject(objectMapping.planId, "DESTINATION", objectMapping.destinationObjectName),
  ]);
  const [sourceFields, destFields] = await Promise.all([
    currentSourceObj
      ? db.objectField.findMany({ where: { objectId: currentSourceObj.id } })
      : Promise.resolve([]),
    currentDestObj
      ? db.objectField.findMany({ where: { objectId: currentDestObj.id } })
      : Promise.resolve([]),
  ]);
  const sourceByApiName = new Map(sourceFields.map((f) => [f.apiName, f]));
  const destByApiName = new Map(destFields.map((f) => [f.apiName, f]));

  return mappings.map((m) =>
    toDTO(
      m,
      sourceByApiName.get(m.sourceFieldName) ?? null,
      destByApiName.get(m.destinationFieldName) ?? null,
    ),
  );
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

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
      compatibilityStatus: checkTypeCompatibility(
        input.sourceFieldType,
        input.destinationFieldType,
      ),
    },
  });
}

export async function deleteFieldMapping(objectMappingId: string, fieldMappingId: string) {
  return db.fieldMapping.deleteMany({ where: { id: fieldMappingId, objectMappingId } });
}

// ─── Auto-match ────────────────────────────────────────────────────────────────

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
          compatibilityStatus: checkTypeCompatibility(sourceType, destinationType),
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
