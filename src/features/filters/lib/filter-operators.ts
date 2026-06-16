// 015-migration-filters — Operator definitions with French labels
// Aligns with FilterOperator enum in prisma/schema.prisma

import type { FilterOperator } from '../types'

export interface FilterOperatorMeta {
  value: FilterOperator
  /** French label for display in UI */
  label: string
  /** Whether this operator requires a value input */
  needsValue: boolean
  /** Recommended field dataTypes for this operator */
  applicableTypes: string[]
}

export const FILTER_OPERATORS: FilterOperatorMeta[] = [
  {
    value: 'EQUALS',
    label: 'Est égal à',
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url', 'picklist', 'id', 'int', 'currency', 'percent', 'boolean', 'date', 'datetime', 'reference'],
  },
  {
    value: 'NOT_EQUALS',
    label: "N'est pas égal à",
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url', 'picklist', 'id', 'int', 'currency', 'percent', 'boolean', 'date', 'datetime', 'reference'],
  },
  {
    value: 'CONTAINS',
    label: 'Contient',
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url'],
  },
  {
    value: 'NOT_CONTAINS',
    label: 'Ne contient pas',
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url'],
  },
  {
    value: 'STARTS_WITH',
    label: 'Commence par',
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url'],
  },
  {
    value: 'ENDS_WITH',
    label: 'Se termine par',
    needsValue: true,
    applicableTypes: ['string', 'email', 'phone', 'url'],
  },
  {
    value: 'GREATER_THAN',
    label: 'Supérieur à',
    needsValue: true,
    applicableTypes: ['int', 'currency', 'percent', 'date', 'datetime'],
  },
  {
    value: 'LESS_THAN',
    label: 'Inférieur à',
    needsValue: true,
    applicableTypes: ['int', 'currency', 'percent', 'date', 'datetime'],
  },
  {
    value: 'IS_NULL',
    label: 'Est vide',
    needsValue: false,
    applicableTypes: ['string', 'email', 'phone', 'url', 'picklist', 'id', 'int', 'currency', 'percent', 'boolean', 'date', 'datetime', 'reference'],
  },
  {
    value: 'DATE_AFTER',
    label: 'Après le',
    needsValue: true,
    applicableTypes: ['date', 'datetime'],
  },
  {
    value: 'DATE_BEFORE',
    label: 'Avant le',
    needsValue: true,
    applicableTypes: ['date', 'datetime'],
  },
]

const VALID_OPERATOR_SET = new Set<string>(FILTER_OPERATORS.map((op) => op.value))

export function isValidOperator(op: string): op is FilterOperator {
  return VALID_OPERATOR_SET.has(op)
}

export function getOperatorMeta(op: FilterOperator): FilterOperatorMeta | undefined {
  return FILTER_OPERATORS.find((m) => m.value === op)
}

/** Date operators that expect ISO 8601 YYYY-MM-DD values */
export const DATE_OPERATORS: Set<FilterOperator> = new Set(['DATE_AFTER', 'DATE_BEFORE'])

/** Operators that work purely on text (case-insensitive substring / prefix / suffix matching) */
export const TEXT_OPERATORS: Set<FilterOperator> = new Set(['CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH'])
