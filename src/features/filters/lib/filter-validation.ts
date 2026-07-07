// Validation d'un filtre — porté tel quel de v4 (02-domain-rules règle 5).
// Logique pure, aucune I/O.
//
// Erreurs dures (valid:false) : champ/opérateur manquant, opérateur inconnu,
// champ inexistant dans le schéma source.
// Warnings souples (valid:true + warning) : opérateur date sur champ non-date,
// valeur date non-ISO, opérateur texte sur champ non-texte.

import { isValidOperator, DATE_OPERATORS, TEXT_OPERATORS } from "./filter-operators";
import type { FilterOperator } from "../types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export function validateFilter(
  input: { fieldApiName: string; operator: string; value?: string },
  sourceFields: { apiName: string; dataType: string }[],
): ValidationResult {
  // ── Erreurs dures ─────────────────────────────────────────────────────────
  if (!input.fieldApiName || !input.fieldApiName.trim()) {
    return { valid: false, error: "Le champ source est requis." };
  }
  if (!input.operator) {
    return { valid: false, error: "L'opérateur est requis." };
  }
  if (!isValidOperator(input.operator)) {
    return { valid: false, error: `Opérateur invalide : "${input.operator}".` };
  }
  const operator = input.operator as FilterOperator;

  const sourceField = sourceFields.find((f) => f.apiName === input.fieldApiName);
  if (!sourceField) {
    return {
      valid: false,
      error: `Le champ source "${input.fieldApiName}" n'existe pas dans l'objet source.`,
    };
  }

  // ── Warnings souples ──────────────────────────────────────────────────────
  const dataType = sourceField.dataType.toLowerCase();

  if (DATE_OPERATORS.has(operator)) {
    const isDateField = dataType === "date" || dataType === "datetime";
    if (!isDateField) {
      return {
        valid: true,
        warning: `L'opérateur ${operator} est conçu pour les champs de type date. Le champ "${input.fieldApiName}" est de type "${sourceField.dataType}" — le système source peut ne pas supporter cette combinaison.`,
      };
    }
    if (input.value && !ISO_DATE_RE.test(input.value)) {
      return {
        valid: true,
        warning: `La valeur "${input.value}" n'est pas au format ISO 8601 (YYYY-MM-DD) attendu par les opérateurs de date.`,
      };
    }
  }

  if (TEXT_OPERATORS.has(operator)) {
    const isTextCompatible = ["string", "email", "phone", "url"].includes(dataType);
    if (!isTextCompatible) {
      return {
        valid: true,
        warning: `L'opérateur ${operator} est conçu pour les champs texte. Le champ "${input.fieldApiName}" est de type "${sourceField.dataType}".`,
      };
    }
  }

  return { valid: true };
}
