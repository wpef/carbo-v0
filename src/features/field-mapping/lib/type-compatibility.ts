// Normalisation de types + matrice de compatibilité + dérivation de section.
// Porté tel quel de v4 (02-domain-rules règle 2 — validé en recette réelle).
// Pur TypeScript — pas de DB, pas de Prisma, pas de React, pas de réseau.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NormalizedType = "text" | "number" | "date" | "picklist" | "boolean";
export type CompatibilityStatus = "COMPATIBLE" | "WARNING" | "INCOMPATIBLE";
export type SectionType = "VALUE_EQUIVALENCE" | "PROMPT" | "ERROR" | "INFORMATIONAL";

export interface CompatibilityEntry {
  status: CompatibilityStatus;
}

export type CompatibilityMatrix = Record<
  NormalizedType,
  Record<NormalizedType, CompatibilityEntry>
>;

// ─── TYPE_NORMALIZATION ─────────────────────────────────────────────────────────
// Tout dataType connecteur (insensible à la casse, trimé) est projeté sur un
// des 5 types canoniques. Type inconnu → 'text' (le plus permissif).

export const TYPE_NORMALIZATION: Record<string, NormalizedType> = {
  // Salesforce — texte
  string: "text",
  textarea: "text",
  url: "text",
  email: "text",
  phone: "text",
  id: "text",
  reference: "text",
  address: "text",
  encryptedstring: "text",
  richtext: "text",
  // Salesforce — numérique
  int: "number",
  integer: "number",
  double: "number",
  float: "number",
  decimal: "number",
  currency: "number",
  percent: "number",
  long: "number",
  // Salesforce — date/heure
  date: "date",
  datetime: "date",
  time: "date",
  // Salesforce — listes
  picklist: "picklist",
  multipicklist: "picklist",
  combobox: "picklist",
  // Salesforce — booléen
  boolean: "boolean",
  checkbox: "boolean",

  // HubSpot
  text: "text",
  number: "number",
  enumeration: "picklist",
  enum: "picklist",
  select: "picklist",
  bool: "boolean",
};

/** Normalise un dataType connecteur brut ; inconnu → 'text'. */
export function normalizeType(dataType: string): NormalizedType {
  return TYPE_NORMALIZATION[dataType.toLowerCase().trim()] ?? "text";
}

// ─── Matrice de compatibilité ───────────────────────────────────────────────────
// 5×5, lignes = source, colonnes = destination.
// COMPATIBLE = D4 (copie informative) ou D1 (équivalence de valeurs)
// WARNING    = D2 (prompt de classification requis)
// INCOMPATIBLE = D3 (erreur — non migrable par le moteur)

const COMPATIBILITY_MATRIX: CompatibilityMatrix = {
  text: {
    text: { status: "COMPATIBLE" }, // D4
    number: { status: "INCOMPATIBLE" }, // D3
    date: { status: "INCOMPATIBLE" }, // D3
    picklist: { status: "WARNING" }, // D2
    boolean: { status: "INCOMPATIBLE" }, // D3
  },
  number: {
    text: { status: "COMPATIBLE" }, // D4
    number: { status: "COMPATIBLE" }, // D4
    date: { status: "INCOMPATIBLE" }, // D3
    picklist: { status: "WARNING" }, // D2
    boolean: { status: "INCOMPATIBLE" }, // D3
  },
  date: {
    text: { status: "COMPATIBLE" }, // D4
    number: { status: "INCOMPATIBLE" }, // D3
    date: { status: "COMPATIBLE" }, // D4
    picklist: { status: "WARNING" }, // D2
    boolean: { status: "INCOMPATIBLE" }, // D3
  },
  picklist: {
    text: { status: "COMPATIBLE" }, // D4
    number: { status: "INCOMPATIBLE" }, // D3
    date: { status: "INCOMPATIBLE" }, // D3
    picklist: { status: "COMPATIBLE" }, // D1
    boolean: { status: "COMPATIBLE" }, // D1
  },
  boolean: {
    text: { status: "COMPATIBLE" }, // D4 : « Vrai ou Faux »
    number: { status: "COMPATIBLE" }, // D4 : « Vrai=>1, Faux=>0 »
    date: { status: "INCOMPATIBLE" }, // D3
    picklist: { status: "COMPATIBLE" }, // D1
    boolean: { status: "COMPATIBLE" }, // D4
  },
};

/** Statut de compatibilité entre un type source et un type destination. */
export function checkTypeCompatibility(
  sourceType: string,
  destType: string,
): CompatibilityStatus {
  const src = normalizeType(sourceType);
  const dst = normalizeType(destType);
  return COMPATIBILITY_MATRIX[src][dst].status;
}

// ─── Dérivation de section (D1–D4) ─────────────────────────────────────────────

/**
 * Dérive la section du modal de logique de migration depuis la paire de types.
 * Ordre d'évaluation exact (02-domain-rules règle 2) :
 *
 * D1 VALUE_EQUIVALENCE — picklist→(picklist|boolean), boolean→picklist
 * D2 PROMPT            — tout autre →picklist (classification LLM)
 * D4 INFORMATIONAL     — même type ou conversions directes (copie auto-validée)
 * D3 ERROR             — tout le reste (incompatible)
 */
export function getSectionType(sourceType: string, destType: string): SectionType {
  const src = normalizeType(sourceType);
  const dst = normalizeType(destType);

  // D1 — équivalence de valeurs
  if (src === "picklist" && (dst === "picklist" || dst === "boolean")) return "VALUE_EQUIVALENCE";
  if (src === "boolean" && dst === "picklist") return "VALUE_EQUIVALENCE";

  // D2 — prompt : text/number/date → picklist (hors D1)
  if (dst === "picklist") return "PROMPT";

  // D4 — copie informative (aucune logique requise)
  if (src === dst) return "INFORMATIONAL";
  if (src === "picklist" && dst === "text") return "INFORMATIONAL";
  if (src === "boolean" && (dst === "text" || dst === "number" || dst === "boolean"))
    return "INFORMATIONAL";
  if (src === "number" && dst === "text") return "INFORMATIONAL";
  if (src === "date" && dst === "text") return "INFORMATIONAL";

  // D3 — incompatible
  return "ERROR";
}
