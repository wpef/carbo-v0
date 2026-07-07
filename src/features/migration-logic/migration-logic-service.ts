// Logique de migration (sections D1–D4) — porté de v4 (02-domain-rules règle 2).
// Le sectionType n'a pas de colonne : dérivé à la volée via getSectionType et
// sérialisé dans le JSON `config` pour reconstruction du DTO.

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { getSectionType } from "@/features/field-mapping/lib/type-compatibility";
import type { SectionType } from "@/features/field-mapping/lib/type-compatibility";
import type { LogicStatus } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type { SectionType };

export interface MigrationLogicDTO {
  id: string;
  fieldMappingId: string;
  sectionType: SectionType;
  status: LogicStatus;
  valueEquivalences: { id: string; sourceValue: string; destinationValue: string }[];
  classificationPrompt: { id: string; promptText: string } | null;
}

export interface SaveMigrationLogicInput {
  sectionType: SectionType;
  /** DEFINED (enregistrer / orange) ou VALIDATED (valider / vert). */
  status: LogicStatus;
  /** D1 (VALUE_EQUIVALENCE). */
  valueEquivalences?: { sourceValue: string; destinationValue: string }[];
  /** D2 (PROMPT). */
  promptText?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const INCLUDE = { valueEquivalences: true, classificationPrompt: true } as const;

type DbLogic = {
  id: string;
  fieldMappingId: string;
  status: LogicStatus;
  config: string;
  valueEquivalences: { id: string; sourceValue: string; destinationValue: string }[];
  classificationPrompt: { id: string; promptText: string } | null;
};

function extractSectionType(config: string): SectionType {
  try {
    const parsed = JSON.parse(config) as { sectionType?: string };
    const st = parsed.sectionType;
    if (st === "VALUE_EQUIVALENCE" || st === "PROMPT" || st === "ERROR" || st === "INFORMATIONAL") {
      return st;
    }
  } catch {
    // config illisible → fallback
  }
  return "INFORMATIONAL";
}

function toDTO(logic: DbLogic): MigrationLogicDTO {
  return {
    id: logic.id,
    fieldMappingId: logic.fieldMappingId,
    sectionType: extractSectionType(logic.config),
    status: logic.status,
    valueEquivalences: logic.valueEquivalences,
    classificationPrompt: logic.classificationPrompt,
  };
}

// ─── getInformationalMessage (D4) ──────────────────────────────────────────────

/** Message informatif D4 pour une combinaison de types (messages v4 exacts). */
export function getInformationalMessage(sourceType: string, destType: string): string {
  const normalizeForMsg = (t: string) => {
    const lower = t.toLowerCase().trim();
    if (["boolean", "bool", "checkbox"].includes(lower)) return "boolean";
    if (["picklist", "multipicklist", "enum", "enumeration", "select", "combobox"].includes(lower))
      return "picklist";
    return lower;
  };
  const src = normalizeForMsg(sourceType);
  const dst = normalizeForMsg(destType);
  if (src === "boolean" && dst === "text") return "Vrai ou Faux";
  if (src === "boolean" && dst === "number") return "Vrai=>1, Faux=>0";
  return "La valeur sera copiée.";
}

// ─── Lecture ───────────────────────────────────────────────────────────────────

export async function getMigrationLogic(fieldMappingId: string): Promise<MigrationLogicDTO | null> {
  const logic = await db.migrationLogic.findUnique({
    where: { fieldMappingId },
    include: INCLUDE,
  });
  return logic ? toDTO(logic) : null;
}

// ─── saveMigrationLogic ────────────────────────────────────────────────────────

/**
 * Upsert de la logique d'un mapping de champ.
 * - D1 : remplace atomiquement les ValueEquivalence ;
 * - D2 : upsert du ClassificationPrompt ;
 * - D3/D4 : config + status seulement.
 */
export async function saveMigrationLogic(
  planId: string,
  fieldMappingId: string,
  input: SaveMigrationLogicInput,
): Promise<MigrationLogicDTO> {
  const config = JSON.stringify({ sectionType: input.sectionType });

  const existing = await db.migrationLogic.findUnique({ where: { fieldMappingId } });
  const logic = await db.migrationLogic.upsert({
    where: { fieldMappingId },
    create: { fieldMappingId, status: input.status, config },
    update: { status: input.status, config },
  });

  if (input.sectionType === "VALUE_EQUIVALENCE" && input.valueEquivalences !== undefined) {
    await db.valueEquivalence.deleteMany({ where: { migrationLogicId: logic.id } });
    if (input.valueEquivalences.length > 0) {
      await db.valueEquivalence.createMany({
        data: input.valueEquivalences.map((ve) => ({
          migrationLogicId: logic.id,
          sourceValue: ve.sourceValue,
          destinationValue: ve.destinationValue,
        })),
      });
    }
  }

  if (input.sectionType === "PROMPT" && input.promptText !== undefined) {
    await db.classificationPrompt.upsert({
      where: { migrationLogicId: logic.id },
      create: { migrationLogicId: logic.id, promptText: input.promptText },
      update: { promptText: input.promptText },
    });
  }

  const updated = await db.migrationLogic.findUniqueOrThrow({
    where: { id: logic.id },
    include: INCLUDE,
  });

  await logAuditEvent({
    planId,
    action: existing ? "MIGRATION_LOGIC_UPDATED" : "MIGRATION_LOGIC_CREATED",
    entity: "MigrationLogic",
    entityId: logic.id,
    details: {
      fieldMappingId,
      sectionType: input.sectionType,
      status: input.status,
      valueEquivalenceCount: input.valueEquivalences?.length,
    },
  });

  return toDTO(updated);
}

// ─── buildMigrationLogicContext ────────────────────────────────────────────────

/**
 * Résout les métadonnées des deux champs pour hydrater le modal : types du
 * snapshot CURRENT (fallback types stockés), picklists (valeurs booléennes
 * synthétisées ['True','False']), sectionType dérivé, message D4.
 * Retourne null si le mapping n'existe pas.
 */
export async function buildMigrationLogicContext(fieldMappingId: string) {
  const fieldMapping = await db.fieldMapping.findUnique({
    where: { id: fieldMappingId },
    include: {
      objectMapping: {
        select: { planId: true, sourceObjectName: true, destinationObjectName: true },
      },
    },
  });
  if (!fieldMapping) return null;

  const { planId, sourceObjectName, destinationObjectName } = fieldMapping.objectMapping;
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  });
  if (!plan) return null;

  const findField = async (
    connectionId: string | null,
    side: "SOURCE" | "DESTINATION",
    objectApiName: string,
    fieldApiName: string,
  ) => {
    if (!connectionId) return null;
    const snapshot = await db.schemaSnapshot.findFirst({
      where: { connectionId, side, status: "CURRENT" },
      select: { id: true },
    });
    if (!snapshot) return null;
    const object = await db.schemaObject.findFirst({
      where: { snapshotId: snapshot.id, apiName: objectApiName },
      select: { id: true },
    });
    if (!object) return null;
    return db.objectField.findFirst({
      where: { objectId: object.id, apiName: fieldApiName },
    });
  };

  const [sourceField, destField] = await Promise.all([
    findField(plan.sourceConnectionId, "SOURCE", sourceObjectName, fieldMapping.sourceFieldName),
    findField(
      plan.destinationConnectionId,
      "DESTINATION",
      destinationObjectName,
      fieldMapping.destinationFieldName,
    ),
  ]);

  const sourceFieldType = sourceField?.dataType ?? fieldMapping.sourceFieldType ?? "text";
  const destFieldType = destField?.dataType ?? fieldMapping.destinationFieldType ?? "text";
  const sectionType = getSectionType(sourceFieldType, destFieldType);

  const parsePicklist = (raw: string | null | undefined, type: string): string[] => {
    if (raw) {
      try {
        return JSON.parse(raw) as string[];
      } catch {
        // valeur illisible → on retombe sur la synthèse
      }
    }
    // Les booléens sans picklist ont des valeurs synthétisées pour le modal D1.
    if (["boolean", "bool", "checkbox"].includes(type.toLowerCase().trim()))
      return ["True", "False"];
    return [];
  };

  const sourcePicklistValues = parsePicklist(sourceField?.picklistValues, sourceFieldType);
  const destPicklistValues = parsePicklist(destField?.picklistValues, destFieldType);

  // Échantillon source pour D2 — placeholder tant que l'aperçu de records
  // n'alimente pas de vraies valeurs (tranche aperçu).
  const sampleSourceValues: string[] =
    sectionType === "PROMPT"
      ? ["Valeur exemple 1", "Valeur exemple 2", "Valeur exemple 3", "Valeur exemple 4"]
      : [];

  return {
    planId,
    fieldMappingId,
    sourceField: {
      name: fieldMapping.sourceFieldName,
      label: sourceField?.label ?? fieldMapping.sourceFieldName,
      type: sourceFieldType,
    },
    destinationField: {
      name: fieldMapping.destinationFieldName,
      label: destField?.label ?? fieldMapping.destinationFieldName,
      type: destFieldType,
    },
    sectionType,
    sourcePicklistValues,
    destPicklistValues,
    sampleSourceValues,
    informationalMessage:
      sectionType === "INFORMATIONAL"
        ? getInformationalMessage(sourceFieldType, destFieldType)
        : null,
  };
}
