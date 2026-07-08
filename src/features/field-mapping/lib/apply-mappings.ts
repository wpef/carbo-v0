// Projection d'un enregistrement source vers l'objet destination pour l'APERÇU
// (02-domain-rules règle 10). Pur : copie directe + application des
// équivalences de valeurs D1. Aucune I/O.

export interface PreviewFieldMapping {
  sourceFieldName: string;
  destinationFieldName: string;
  migrationLogic: {
    sectionType: string;
    valueEquivalences: { sourceValue: string; destinationValue: string }[];
  } | null;
}

/**
 * Canonicalise une valeur source pour la comparer aux clés d'équivalence.
 * Les booléens sont projetés sur "True"/"False" — exactement les valeurs
 * synthétisées par le modal D1 pour un champ booléen (sinon String(true)
 * = "true" ne matcherait jamais la clé "True" : l'équivalence booléenne
 * serait silencieusement ignorée).
 */
export function canonicalizeSourceValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw ? "True" : "False";
  return String(raw);
}

/** Cherche l'équivalence D1 : exact d'abord, repli insensible à la casse. */
function findEquivalence(
  equivalences: { sourceValue: string; destinationValue: string }[],
  canonical: string,
): { sourceValue: string; destinationValue: string } | undefined {
  return (
    equivalences.find((ve) => ve.sourceValue === canonical) ??
    equivalences.find((ve) => ve.sourceValue.toLowerCase() === canonical.toLowerCase())
  );
}

/**
 * Projette l'objet destination : pour chaque mapping, copie la valeur source ;
 * si une logique D1 (VALUE_EQUIVALENCE) existe et matche, applique la valeur
 * destination équivalente.
 */
export function applyMappings(
  sourceRecord: Record<string, unknown>,
  fieldMappings: PreviewFieldMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const m of fieldMappings) {
    const raw = sourceRecord[m.sourceFieldName];
    let transformed: unknown = raw;
    const logic = m.migrationLogic;
    if (logic && logic.sectionType === "VALUE_EQUIVALENCE" && logic.valueEquivalences.length > 0) {
      const canonical = canonicalizeSourceValue(raw);
      const match = canonical !== null ? findEquivalence(logic.valueEquivalences, canonical) : undefined;
      if (match) transformed = match.destinationValue;
    }
    result[m.destinationFieldName] = transformed;
  }
  return result;
}
