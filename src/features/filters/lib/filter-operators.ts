// Les 11 opérateurs de filtre, labels français — porté tel quel de v4
// (02-domain-rules règle 5). Aligné sur l'enum Prisma FilterOperator.

import type { FilterOperator } from "../types";

export interface FilterOperatorMeta {
  value: FilterOperator;
  /** Label français affiché dans l'UI. */
  label: string;
  /** L'opérateur exige-t-il une valeur ? (IS_NULL est le seul à false) */
  needsValue: boolean;
  /** Types de champ recommandés. */
  applicableTypes: string[];
}

const ANY_TYPE = [
  "string",
  "email",
  "phone",
  "url",
  "picklist",
  "id",
  "int",
  "currency",
  "percent",
  "boolean",
  "date",
  "datetime",
  "reference",
];
const TEXT_TYPES = ["string", "email", "phone", "url"];
const ORDERED_TYPES = ["int", "currency", "percent", "date", "datetime"];

export const FILTER_OPERATORS: FilterOperatorMeta[] = [
  { value: "EQUALS", label: "Est égal à", needsValue: true, applicableTypes: ANY_TYPE },
  { value: "NOT_EQUALS", label: "N'est pas égal à", needsValue: true, applicableTypes: ANY_TYPE },
  { value: "CONTAINS", label: "Contient", needsValue: true, applicableTypes: TEXT_TYPES },
  { value: "NOT_CONTAINS", label: "Ne contient pas", needsValue: true, applicableTypes: TEXT_TYPES },
  { value: "STARTS_WITH", label: "Commence par", needsValue: true, applicableTypes: TEXT_TYPES },
  { value: "ENDS_WITH", label: "Se termine par", needsValue: true, applicableTypes: TEXT_TYPES },
  { value: "GREATER_THAN", label: "Supérieur à", needsValue: true, applicableTypes: ORDERED_TYPES },
  { value: "LESS_THAN", label: "Inférieur à", needsValue: true, applicableTypes: ORDERED_TYPES },
  { value: "IS_NULL", label: "Est vide", needsValue: false, applicableTypes: ANY_TYPE },
  { value: "DATE_AFTER", label: "Après le", needsValue: true, applicableTypes: ["date", "datetime"] },
  { value: "DATE_BEFORE", label: "Avant le", needsValue: true, applicableTypes: ["date", "datetime"] },
];

const VALID_OPERATOR_SET = new Set<string>(FILTER_OPERATORS.map((op) => op.value));

/** Sensible à la casse (02-domain-rules règle 5). */
export function isValidOperator(op: string): op is FilterOperator {
  return VALID_OPERATOR_SET.has(op);
}

export function getOperatorMeta(op: FilterOperator): FilterOperatorMeta | undefined {
  return FILTER_OPERATORS.find((m) => m.value === op);
}

/** Opérateurs de date — valeur ISO 8601 YYYY-MM-DD attendue. */
export const DATE_OPERATORS: Set<FilterOperator> = new Set(["DATE_AFTER", "DATE_BEFORE"]);

/** Opérateurs purement texte (sous-chaîne / préfixe / suffixe). */
export const TEXT_OPERATORS: Set<FilterOperator> = new Set([
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
]);
