// Rapport de couverture des champs d'une paire (02-domain-rules règle 7) —
// porté de v4. Pur : aucune DB, aucun réseau.
//
// Un champ source est « traité » s'il est mappé OU exclu.
// Côté destination, seuls les champs REQUIS et MODIFIABLES comptent (un champ
// requis en lecture seule — ex. identifiant système — ne se mappe pas ; c'est
// un raffinement v5 vs v4 qui ignorait isReadOnly).

export interface FieldInfo {
  apiName: string;
  label: string;
  dataType: string;
  isRequired: boolean;
}

export interface FieldExclusionInfo {
  id: string;
  sourceFieldName: string;
  reason: string | null;
}

export interface UnmappedInputField {
  apiName: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  isReadOnly: boolean;
}

export interface UnmappedFieldsReport {
  unmappedSourceFields: FieldInfo[];
  excludedSourceFields: FieldExclusionInfo[];
  sourceCoverage: number; // (mappés + exclus) / total × 100, arrondi

  unmappedRequiredDestFields: FieldInfo[];
  destinationRequiredCoverage: number; // mappésRequis / totalRequis × 100, arrondi

  totalSourceFields: number;
  mappedSourceFields: number;
  totalRequiredDestFields: number;
  mappedRequiredDestFields: number;
  fieldsRemainingToValidate: number;
  isComplete: boolean; // sur valeurs BRUTES (=== 100 strict, évite 99,9 → 100)
}

function toFieldInfo(f: UnmappedInputField): FieldInfo {
  return { apiName: f.apiName, label: f.label, dataType: f.dataType, isRequired: f.isRequired };
}

export function computeUnmappedFields(
  sourceFields: UnmappedInputField[],
  destFields: UnmappedInputField[],
  fieldMappings: { sourceFieldName: string; destinationFieldName: string }[],
  exclusions: FieldExclusionInfo[],
): UnmappedFieldsReport {
  const mappedSourceNames = new Set(fieldMappings.map((fm) => fm.sourceFieldName));
  const mappedDestNames = new Set(fieldMappings.map((fm) => fm.destinationFieldName));
  const excludedSourceNames = new Set(exclusions.map((e) => e.sourceFieldName));

  // ── Source ────────────────────────────────────────────────────────────────
  const unmappedSourceFields = sourceFields
    .filter((f) => !mappedSourceNames.has(f.apiName) && !excludedSourceNames.has(f.apiName))
    .map(toFieldInfo);

  const mappedSourceCount = sourceFields.filter((f) => mappedSourceNames.has(f.apiName)).length;
  const excludedCount = sourceFields.filter((f) => excludedSourceNames.has(f.apiName)).length;

  const sourceCoverageRaw =
    sourceFields.length > 0
      ? ((mappedSourceCount + excludedCount) / sourceFields.length) * 100
      : 100;

  // ── Destination : champs requis ET modifiables ─────────────────────────────
  const requiredDestFields = destFields.filter((f) => f.isRequired && !f.isReadOnly);
  const unmappedRequiredDestFields = requiredDestFields
    .filter((f) => !mappedDestNames.has(f.apiName))
    .map(toFieldInfo);
  const mappedRequiredDestCount = requiredDestFields.filter((f) =>
    mappedDestNames.has(f.apiName),
  ).length;

  const destRequiredCoverageRaw =
    requiredDestFields.length > 0
      ? (mappedRequiredDestCount / requiredDestFields.length) * 100
      : 100;

  const isComplete = sourceCoverageRaw === 100 && destRequiredCoverageRaw === 100;

  return {
    unmappedSourceFields,
    excludedSourceFields: exclusions,
    sourceCoverage: Math.round(sourceCoverageRaw),
    unmappedRequiredDestFields,
    destinationRequiredCoverage: Math.round(destRequiredCoverageRaw),
    totalSourceFields: sourceFields.length,
    mappedSourceFields: mappedSourceCount,
    totalRequiredDestFields: requiredDestFields.length,
    mappedRequiredDestFields: mappedRequiredDestCount,
    fieldsRemainingToValidate: unmappedSourceFields.length + unmappedRequiredDestFields.length,
    isComplete,
  };
}
