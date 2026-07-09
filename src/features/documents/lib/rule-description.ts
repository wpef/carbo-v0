// Descriptions de règles — générateurs de texte purs (template) par type de règle.
// Porté de v4 (05-acceptance §12, validé en recette). Sémantique inchangée.
//
// Couvre tous les types de règles de migration :
//   DIRECT_COPY        — types identiques ou compatibles, sans logique
//   VALUE_EQUIVALENCE  — table d'équivalence source→destination explicite
//   PROMPT             — classification LLM (fallback pur ; LLM câblé plus tard)
//   INFORMATIONAL      — message libre porté par la règle
//   ERROR / INCOMPATIBLE — incompatibilité de types ; champ exclu de la migration
//
// Toutes les fonctions sont PURES : pas de DB, pas de réseau, pas de React,
// pas de Prisma. Les types sont auto-contenus dans ce module.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleType =
  | "DIRECT_COPY"
  | "VALUE_EQUIVALENCE"
  | "PROMPT"
  | "INFORMATIONAL"
  | "ERROR"
  | "INCOMPATIBLE"; // alias conservé pour compatibilité service

export type DescriptionSource = "template" | "fallback";

export interface ValueEquivalencePair {
  sourceValue: string;
  destinationValue: string;
}

/** Entrée d'une demande de description (pure, aucun id DB requis). */
export interface RuleDescriptionInput {
  ruleType: RuleType;
  /** VALUE_EQUIVALENCE — liste de paires source→destination */
  valueEquivalences?: ValueEquivalencePair[];
  /** INFORMATIONAL — message pré-rédigé */
  informationalMessage?: string | null;
  /** ERROR / INCOMPATIBLE — type source */
  sourceType?: string | null;
  /** ERROR / INCOMPATIBLE — type destination */
  destType?: string | null;
  /** PROMPT — texte de classification (LLM stubbé ; retourne le fallback) */
  promptText?: string | null;
  /** DIRECT_COPY — type source */
  sourceDataType?: string | null;
  /** DIRECT_COPY — type destination */
  destDataType?: string | null;
}

/** Sortie d'une description de règle. */
export interface RuleDescriptionOutput {
  description: string;
  source: DescriptionSource;
}

// ---------------------------------------------------------------------------
// Générateurs purs par type
// ---------------------------------------------------------------------------

/** Nombre max d'équivalences listées avant le résumé « and N more ». */
const MAX_LISTED = 5;

/**
 * DIRECT_COPY — copie de même type ou de type compatible.
 *
 * Exemples :
 *   'text' === 'text'     → "Copie directe (text → text)"
 *   'text' !== 'textarea' → "Copie avec conversion de type (text → textarea)"
 */
export function describeDirectCopy(
  sourceType: string | null | undefined,
  destType: string | null | undefined,
): string {
  const src = sourceType ?? "unknown";
  const dst = destType ?? "unknown";
  if (src === dst) {
    return `Copie directe (${src} → ${dst})`;
  }
  return `Copie avec conversion de type (${src} → ${dst})`;
}

/**
 * VALUE_EQUIVALENCE — liste les MAX_LISTED premières paires puis résume le reste.
 *
 * Exemples :
 *   0 paire            → "No value equivalences have been defined."
 *   5 paires           → "'Web' becomes 'Online', 'Referral' becomes 'Partner', ..."
 *   12 paires          → "... (5 premières listées), and 7 more equivalences."
 *   sources non mappées → ajoute "N source values have no destination equivalent."
 */
export function describeValueEquivalence(equivalences: ValueEquivalencePair[]): string {
  if (equivalences.length === 0) {
    return "No value equivalences have been defined.";
  }

  const unmapped = equivalences.filter((e) => !e.destinationValue || e.destinationValue.trim() === "");
  const mapped = equivalences.filter((e) => e.destinationValue && e.destinationValue.trim() !== "");

  const listed = mapped.slice(0, MAX_LISTED);
  const listStr = listed.map((e) => `'${e.sourceValue}' becomes '${e.destinationValue}'`).join(", ");

  let description = listStr;

  const remaining = mapped.length - listed.length;
  if (remaining > 0) {
    description += `, and ${remaining} more equivalence${remaining === 1 ? "" : "s"}.`;
  }

  if (unmapped.length > 0) {
    const suffix =
      `${unmapped.length} source value${unmapped.length === 1 ? "" : "s"} ` +
      `${unmapped.length === 1 ? "has" : "have"} no destination equivalent.`;
    description += (description.endsWith(".") ? " " : ". ") + suffix;
  }

  return description;
}

/**
 * INFORMATIONAL — retourne le message pré-rédigé tel quel.
 * Retombe sur un défaut si le message est vide.
 */
export function describeInformational(message: string | null | undefined): string {
  if (!message || message.trim() === "") {
    return "The value will be copied directly.";
  }
  return message.trim();
}

/**
 * ERROR / INCOMPATIBLE — incompatibilité de types ; champ exclu de la migration
 * automatisée.
 *
 * Deux formes :
 *   avec types   → "WARNING: … (text → picklist). …"
 *   sans types   → avertissement générique
 */
export function describeError(
  sourceType: string | null | undefined,
  destType: string | null | undefined,
): string {
  if (sourceType && destType) {
    return (
      `WARNING: This field cannot be migrated due to a type incompatibility ` +
      `(${sourceType} → ${destType}). ` +
      `The unmapped values will be exported to a CSV file for manual review.`
    );
  }
  return (
    "WARNING: This field cannot be migrated due to a type incompatibility. " +
    "The unmapped values will be exported to a CSV file for manual review."
  );
}

/**
 * INCOMPATIBLE (alias v4) — délègue à describeError.
 */
export function describeIncompatible(
  sourceType: string | null | undefined,
  destType: string | null | undefined,
): string {
  return describeError(sourceType, destType);
}

/**
 * PROMPT — appel LLM stubbé dans la couche pure.
 *
 * En contexte pur/test (pas de LLM réel), retourne le texte brut suivi de
 * "(requires review)". Le câblage LLM réel vit dans la couche service.
 */
export function describePromptFallback(promptText: string | null | undefined): string {
  if (!promptText || promptText.trim() === "") {
    return "No classification prompt defined. (requires review)";
  }
  return `${promptText.trim()} (requires review)`;
}

/**
 * Type inconnu / non supporté — fallback attrape-tout.
 */
export function describeUnknown(): string {
  return "Unknown migration logic type — requires review.";
}

// ---------------------------------------------------------------------------
// Dispatcher unifié
// ---------------------------------------------------------------------------

/**
 * Classe une règle et retourne sa description en langage clair.
 *
 * Point d'entrée unique consommé par les générateurs de documents.
 * Les règles PROMPT reçoivent le fallback pur (LLM câblé plus tard).
 */
export function describeRule(input: RuleDescriptionInput): RuleDescriptionOutput {
  switch (input.ruleType) {
    case "DIRECT_COPY":
      return {
        description: describeDirectCopy(input.sourceDataType, input.destDataType),
        source: "template",
      };

    case "VALUE_EQUIVALENCE":
      return {
        description: describeValueEquivalence(input.valueEquivalences ?? []),
        source: "template",
      };

    case "INFORMATIONAL":
      return {
        description: describeInformational(input.informationalMessage),
        source: "template",
      };

    case "ERROR":
    case "INCOMPATIBLE":
      return {
        description: describeError(input.sourceType, input.destType),
        source: "template",
      };

    case "PROMPT":
      return {
        description: describePromptFallback(input.promptText),
        source: "fallback",
      };

    default:
      return {
        description: describeUnknown(),
        source: "fallback",
      };
  }
}
