// Assemblage des sections d'un plan pour les documents (texte + contractuel).
// Résout labels/types des champs sur le snapshot CURRENT, dérive la section
// (getSectionType) puis la description de règle (describeRule), et délègue la
// couverture/exclusions à getCoverageReport (résolution snapshot déjà faite).
//
// Partagé par document-service (texte) et contractual-document-service pour
// éviter la duplication de la boucle de collecte.

import { db } from "@/lib/db";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import { getCoverageReport } from "@/features/unmapped/unmapped-service";
import {
  getSectionType,
  type SectionType,
} from "@/features/field-mapping/lib/type-compatibility";
import { describeRule, type RuleDescriptionInput } from "./lib/rule-description";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FieldRuleRow {
  sourceFieldName: string;
  sourceFieldLabel: string;
  destinationFieldName: string;
  destinationFieldLabel: string;
  sourceType: string;
  destType: string;
  sectionType: SectionType;
  description: string;
  isFallback: boolean;
}

export interface FilterRow {
  fieldApiName: string;
  operator: string;
  value: string | null;
  isActive: boolean;
}

export interface UnmappedEntry {
  apiName: string;
  label: string;
  dataType: string;
}

export interface ExcludedEntry {
  sourceFieldName: string;
  reason: string | null;
}

export interface PlanObjectSection {
  objectMappingId: string;
  sourceObjectName: string;
  destinationObjectName: string;
  sourceObjectLabel: string;
  destinationObjectLabel: string;
  fieldRows: FieldRuleRow[];
  filters: FilterRow[];
  unmappedSourceFields: UnmappedEntry[];
  unmappedRequiredDestFields: UnmappedEntry[];
  excludedSourceFields: ExcludedEntry[];
}

export interface PlanSections {
  planName: string;
  planDescription: string | null;
  sourceName: string;
  destName: string;
  sections: PlanObjectSection[];
  objectCount: number;
  fieldCount: number;
  ruleCount: number; // règles non-triviales (section ≠ INFORMATIONAL)
  filterCount: number; // filtres actifs
  unmappedCount: number; // champs source non mappés (hors exclusions)
  llmCallCount: number; // sections PROMPT rencontrées (LLM stubbé)
}

// ─── Résolution de la description de règle ──────────────────────────────────────

type DbLogic = {
  valueEquivalences: { sourceValue: string; destinationValue: string }[];
  classificationPrompt: { promptText: string } | null;
} | null;

/**
 * Mappe une section (D1–D4) vers un input describeRule.
 * D4 (INFORMATIONAL) = copie directe → describeRule DIRECT_COPY (le message
 * dérivé n'est pas persisté en v5, donc pas de perte).
 */
function describeFieldRule(
  sectionType: SectionType,
  srcType: string,
  dstType: string,
  logic: DbLogic,
): { description: string; isFallback: boolean } {
  let input: RuleDescriptionInput;
  switch (sectionType) {
    case "VALUE_EQUIVALENCE":
      input = { ruleType: "VALUE_EQUIVALENCE", valueEquivalences: logic?.valueEquivalences ?? [] };
      break;
    case "PROMPT":
      input = { ruleType: "PROMPT", promptText: logic?.classificationPrompt?.promptText ?? null };
      break;
    case "ERROR":
      input = { ruleType: "ERROR", sourceType: srcType, destType: dstType };
      break;
    case "INFORMATIONAL":
    default:
      input = { ruleType: "DIRECT_COPY", sourceDataType: srcType, destDataType: dstType };
      break;
  }
  const { description, source } = describeRule(input);
  return { description, isFallback: source === "fallback" };
}

// ─── buildPlanSections ──────────────────────────────────────────────────────────

export async function buildPlanSections(planId: string): Promise<PlanSections> {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
      objectMappings: {
        orderBy: { sourceObjectName: "asc" },
        include: {
          fieldMappings: {
            include: {
              migrationLogic: {
                include: { valueEquivalences: true, classificationPrompt: true },
              },
            },
          },
          filters: true,
          exclusions: true,
        },
      },
    },
  });
  if (!plan) throw new Error("Plan introuvable");

  // Snapshots CURRENT pour libellés + types réels des champs.
  const [sourceSnapshot, destSnapshot] = await Promise.all([
    plan.sourceConnectionId ? getCurrentSnapshot(plan.sourceConnectionId, "SOURCE") : null,
    plan.destinationConnectionId
      ? getCurrentSnapshot(plan.destinationConnectionId, "DESTINATION")
      : null,
  ]);
  const srcObjects = new Map((sourceSnapshot?.objects ?? []).map((o) => [o.apiName, o]));
  const dstObjects = new Map((destSnapshot?.objects ?? []).map((o) => [o.apiName, o]));

  let fieldCount = 0;
  let ruleCount = 0;
  let filterCount = 0;
  let unmappedCount = 0;
  let llmCallCount = 0;

  const sections: PlanObjectSection[] = [];
  for (const om of plan.objectMappings) {
    const srcObj = srcObjects.get(om.sourceObjectName);
    const dstObj = dstObjects.get(om.destinationObjectName);
    const srcFields = new Map((srcObj?.fields ?? []).map((f) => [f.apiName, f]));
    const dstFields = new Map((dstObj?.fields ?? []).map((f) => [f.apiName, f]));

    const fieldRows: FieldRuleRow[] = om.fieldMappings.map((fm) => {
      const sf = srcFields.get(fm.sourceFieldName);
      const df = dstFields.get(fm.destinationFieldName);
      // Type réel du snapshot ; fallback sur le type brut stocké sur le mapping.
      const srcType = sf?.dataType || fm.sourceFieldType || "unknown";
      const dstType = df?.dataType || fm.destinationFieldType || "unknown";
      const sectionType = getSectionType(srcType, dstType);
      const { description, isFallback } = describeFieldRule(
        sectionType,
        srcType,
        dstType,
        fm.migrationLogic,
      );
      if (sectionType !== "INFORMATIONAL") ruleCount++;
      if (sectionType === "PROMPT") llmCallCount++;
      return {
        sourceFieldName: fm.sourceFieldName,
        sourceFieldLabel: sf?.label ?? fm.sourceFieldName,
        destinationFieldName: fm.destinationFieldName,
        destinationFieldLabel: df?.label ?? fm.destinationFieldName,
        sourceType: srcType,
        destType: dstType,
        sectionType,
        description,
        isFallback,
      };
    });
    fieldCount += fieldRows.length;

    const activeFilters = om.filters.filter((f) => f.isActive);
    filterCount += activeFilters.length;

    // Couverture + exclusions : chemin testé (résolution snapshot + exclusions).
    const coverage = await getCoverageReport(om.id);
    unmappedCount += coverage.unmappedSourceFields.length;

    sections.push({
      objectMappingId: om.id,
      sourceObjectName: om.sourceObjectName,
      destinationObjectName: om.destinationObjectName,
      sourceObjectLabel: srcObj?.label ?? om.sourceObjectName,
      destinationObjectLabel: dstObj?.label ?? om.destinationObjectName,
      fieldRows,
      filters: om.filters.map((f) => ({
        fieldApiName: f.fieldApiName,
        operator: f.operator,
        value: f.value,
        isActive: f.isActive,
      })),
      unmappedSourceFields: coverage.unmappedSourceFields.map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
      })),
      unmappedRequiredDestFields: coverage.unmappedRequiredDestFields.map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
      })),
      excludedSourceFields: coverage.excludedSourceFields.map((e) => ({
        sourceFieldName: e.sourceFieldName,
        reason: e.reason,
      })),
    });
  }

  return {
    planName: plan.name,
    planDescription: plan.description,
    sourceName: plan.sourceConnection?.name ?? "N/A",
    destName: plan.destinationConnection?.name ?? "N/A",
    sections,
    objectCount: sections.length,
    fieldCount,
    ruleCount,
    filterCount,
    unmappedCount,
    llmCallCount,
  };
}

// ─── Helpers de rendu partagés ──────────────────────────────────────────────────

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Libellé humain d'un opérateur de filtre (repris des filtres 015). */
export const FILTER_LABEL: Record<string, string> = {
  EQUALS: "est égal à",
  NOT_EQUALS: "est différent de",
  CONTAINS: "contient",
  NOT_CONTAINS: "ne contient pas",
  STARTS_WITH: "commence par",
  ENDS_WITH: "se termine par",
  GREATER_THAN: "supérieur à",
  LESS_THAN: "inférieur à",
  IS_NULL: "est vide",
  DATE_AFTER: "est après le",
  DATE_BEFORE: "est avant le",
};

/** Libellé FR d'une section de règle. */
export const SECTION_LABEL: Record<SectionType, string> = {
  VALUE_EQUIVALENCE: "Équivalence de valeurs",
  PROMPT: "Classification (LLM)",
  ERROR: "Incompatible",
  INFORMATIONAL: "Copie directe",
};
