// Cœur PUR du contrôle d'intégrité (02-domain-rules règle 8) — aucune DB,
// aucune I/O. Extrait pour être testable unitairement (la v4 ne le couvrait
// que par un test d'intégration — lacune A6 du catalogue).
//
// Périmètre BROKEN = CORRUPTION structurelle (ERROR) :
//   - BROKEN_REFERENCE : objet/champ mappé absent du schéma CURRENT
//   - INCOMPATIBLE_TYPE : types actuels incompatibles (matrice règle 2)
//   - INVALID_FILTER    : filtre sur un champ source disparu
// L'INCOMPLÉTUDE (champ requis destination non mappé) n'est PAS une corruption :
// elle relève de la couverture (compute-unmapped) et n'entraîne pas BROKEN.
// C'est un raffinement v5 assumé vs la règle v4 « toute issue → BROKEN », pour
// que BROKEN garde son sens (le plan est cassé, pas seulement inachevé) et
// qu'une paire simplement pas encore mappée ne fasse pas basculer le plan.

import { checkTypeCompatibility } from "@/features/field-mapping/lib/type-compatibility";

export type IntegrityEntityType = "OBJECT_MAPPING" | "FIELD_MAPPING" | "MIGRATION_FILTER";
export type IntegrityIssueType = "BROKEN_REFERENCE" | "INCOMPATIBLE_TYPE" | "INVALID_FILTER";

export interface RawIssue {
  entityType: IntegrityEntityType;
  entityId: string;
  issueType: IntegrityIssueType;
  severity: "ERROR";
  message: string;
}

export interface IntegrityObjectSchema {
  apiName: string;
  fields: { apiName: string; dataType: string }[];
}

export interface IntegrityFieldMapping {
  id: string;
  sourceFieldName: string;
  destinationFieldName: string;
  sourceFieldType: string;
  destinationFieldType: string;
}

export interface IntegrityFilter {
  id: string;
  fieldApiName: string;
}

export interface IntegrityObjectMapping {
  id: string;
  sourceObjectName: string;
  destinationObjectName: string;
  fieldMappings: IntegrityFieldMapping[];
  filters: IntegrityFilter[];
}

/**
 * Détecte les issues de corruption (ERROR) d'un plan à partir de données
 * simples (snapshots CURRENT + mappings). Fonction pure.
 */
export function computeIntegrityIssues(
  sourceObjects: IntegrityObjectSchema[],
  destObjects: IntegrityObjectSchema[],
  objectMappings: IntegrityObjectMapping[],
): RawIssue[] {
  const sourceObjNames = new Set(sourceObjects.map((o) => o.apiName));
  const destObjNames = new Set(destObjects.map((o) => o.apiName));

  const sourceFieldsByObj = new Map<string, Map<string, string>>();
  for (const o of sourceObjects) {
    sourceFieldsByObj.set(o.apiName, new Map(o.fields.map((f) => [f.apiName, f.dataType])));
  }
  const destFieldsByObj = new Map<string, Map<string, string>>();
  for (const o of destObjects) {
    destFieldsByObj.set(o.apiName, new Map(o.fields.map((f) => [f.apiName, f.dataType])));
  }

  const issues: RawIssue[] = [];

  for (const om of objectMappings) {
    // ── BROKEN_REFERENCE niveau objet — on saute les checks de champ ────────
    if (!sourceObjNames.has(om.sourceObjectName)) {
      issues.push({
        entityType: "OBJECT_MAPPING",
        entityId: om.id,
        issueType: "BROKEN_REFERENCE",
        severity: "ERROR",
        message: `L'objet source « ${om.sourceObjectName} » n'existe plus dans le schéma actuel.`,
      });
      continue;
    }
    if (!destObjNames.has(om.destinationObjectName)) {
      issues.push({
        entityType: "OBJECT_MAPPING",
        entityId: om.id,
        issueType: "BROKEN_REFERENCE",
        severity: "ERROR",
        message: `L'objet destination « ${om.destinationObjectName} » n'existe plus dans le schéma actuel.`,
      });
      continue;
    }

    const srcFields = sourceFieldsByObj.get(om.sourceObjectName) ?? new Map();
    const dstFields = destFieldsByObj.get(om.destinationObjectName) ?? new Map();

    // ── Champs ──────────────────────────────────────────────────────────────
    for (const fm of om.fieldMappings) {
      const srcExists = srcFields.has(fm.sourceFieldName);
      const dstExists = dstFields.has(fm.destinationFieldName);

      if (!srcExists) {
        issues.push({
          entityType: "FIELD_MAPPING",
          entityId: fm.id,
          issueType: "BROKEN_REFERENCE",
          severity: "ERROR",
          message: `Le champ source « ${fm.sourceFieldName} » n'existe plus sur « ${om.sourceObjectName} ».`,
        });
      }
      if (!dstExists) {
        issues.push({
          entityType: "FIELD_MAPPING",
          entityId: fm.id,
          issueType: "BROKEN_REFERENCE",
          severity: "ERROR",
          message: `Le champ destination « ${fm.destinationFieldName} » n'existe plus sur « ${om.destinationObjectName} ».`,
        });
      }

      // Incompatibilité de types (types ACTUELS du snapshot, fallback stockés)
      if (srcExists && dstExists) {
        const srcType = srcFields.get(fm.sourceFieldName) ?? fm.sourceFieldType;
        const dstType = dstFields.get(fm.destinationFieldName) ?? fm.destinationFieldType;
        if (checkTypeCompatibility(srcType, dstType) === "INCOMPATIBLE") {
          issues.push({
            entityType: "FIELD_MAPPING",
            entityId: fm.id,
            issueType: "INCOMPATIBLE_TYPE",
            severity: "ERROR",
            message: `Types incompatibles : « ${fm.sourceFieldName} » (${srcType}) → « ${fm.destinationFieldName} » (${dstType}).`,
          });
        }
      }
    }

    // ── Filtres référençant un champ source disparu ─────────────────────────
    for (const filter of om.filters) {
      if (!srcFields.has(filter.fieldApiName)) {
        issues.push({
          entityType: "MIGRATION_FILTER",
          entityId: filter.id,
          issueType: "INVALID_FILTER",
          severity: "ERROR",
          message: `Le filtre sur « ${om.sourceObjectName} » référence un champ source disparu : « ${filter.fieldApiName} ».`,
        });
      }
    }
  }

  return issues;
}

export type PlanStatus = "DRAFT" | "READY" | "BROKEN";

/**
 * Statut du plan (pur) : la corruption prime ; sinon READY seulement si on est
 * à l'étape documents ET qu'il reste au moins une paire mappée (le gate
 * DOCUMENTS est MAINTENU, pas seulement validé à l'aller) ; sinon DRAFT.
 */
export function computePlanStatus(input: {
  errorCount: number;
  currentStep: string;
  hasMappedPair: boolean;
}): PlanStatus {
  if (input.errorCount > 0) return "BROKEN";
  if (input.currentStep === "DOCUMENTS" && input.hasMappedPair) return "READY";
  return "DRAFT";
}
