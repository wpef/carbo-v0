// 015-migration-filters — Filter validation (pure logic, no I/O)
// FR-005: field must exist in source schema
// FR-002: operator must be one of the 9 supported operators

import { isValidOperator, DATE_OPERATORS, TEXT_OPERATORS } from './filter-operators'
import type { FilterOperator } from '../types'
import type { ConnectorField } from '@/lib/types/connector'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ValidationResult {
  valid: boolean
  error?: string
  warning?: string
}

/**
 * Validate a filter creation input against the source object's field list.
 *
 * Hard errors (return valid: false):
 *  - Missing fieldApiName / operator
 *  - Unknown operator
 *  - Field not found in source schema (FR-005)
 *
 * Soft warnings (return valid: true, warning: string):
 *  - DATE operator on non-date field
 *  - Text operator on non-text field
 *  - DATE value not ISO 8601 YYYY-MM-DD
 */
export function validateFilter(
  input: { fieldApiName: string; operator: string; value?: string },
  sourceFields: ConnectorField[],
): ValidationResult {
  // --- Hard validations ---
  if (!input.fieldApiName || !input.fieldApiName.trim()) {
    return { valid: false, error: 'Le champ source est requis.' }
  }

  if (!input.operator) {
    return { valid: false, error: "L'opérateur est requis." }
  }

  if (!isValidOperator(input.operator)) {
    return { valid: false, error: `Opérateur invalide : "${input.operator}".` }
  }

  const operator = input.operator as FilterOperator

  const sourceField = sourceFields.find((f) => f.apiName === input.fieldApiName)
  if (!sourceField) {
    return {
      valid: false,
      error: `Le champ source "${input.fieldApiName}" n'existe pas dans l'objet source.`,
    }
  }

  // --- Soft warnings ---
  const dataType = sourceField.dataType.toLowerCase()

  if (DATE_OPERATORS.has(operator)) {
    const isDateField = dataType === 'date' || dataType === 'datetime'
    if (!isDateField) {
      return {
        valid: true,
        warning: `L'opérateur ${operator} est conçu pour les champs de type date. Le champ "${input.fieldApiName}" est de type "${sourceField.dataType}" — le système source peut ne pas supporter cette combinaison.`,
      }
    }

    // Additional: warn if date value format is not ISO 8601
    if (input.value && !ISO_DATE_RE.test(input.value)) {
      return {
        valid: true,
        warning: `La valeur "${input.value}" n'est pas au format ISO 8601 (YYYY-MM-DD) attendu par les opérateurs de date.`,
      }
    }
  }

  if (TEXT_OPERATORS.has(operator)) {
    const isTextCompatible = ['string', 'email', 'phone', 'url'].includes(dataType)
    if (!isTextCompatible) {
      return {
        valid: true,
        warning: `L'opérateur ${operator} est conçu pour les champs texte. Le champ "${input.fieldApiName}" est de type "${sourceField.dataType}".`,
      }
    }
  }

  return { valid: true }
}
