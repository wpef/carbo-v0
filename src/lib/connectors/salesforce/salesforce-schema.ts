// Salesforce — mapping jsforce describe responses to ConnectorObject / ConnectorField
// Ref: specs/adapters/salesforce/ (T007)

import type { ConnectorField, ConnectorObject } from '@/lib/connectors/types'
import { isDefaultSelected, isSystemObject } from './salesforce-constants'

// --- Minimal shapes we rely on from jsforce's describe results ---
// (jsforce types evolve; we keep a narrow structural view.)

interface DescribeGlobalSObject {
  name: string
  label: string
  custom: boolean
  queryable?: boolean
  retrieveable?: boolean
  deprecatedAndHidden?: boolean
}

interface DescribeGlobalResult {
  sobjects: DescribeGlobalSObject[]
}

interface DescribeField {
  name: string
  label: string
  type: string
  nillable?: boolean
  createable?: boolean
  updateable?: boolean
  unique?: boolean
  referenceTo?: string[]
  relationshipName?: string | null
  inlineHelpText?: string | null
  picklistValues?: Array<{ value: string; label?: string; active?: boolean }>
  length?: number
}

interface DescribeResult {
  name: string
  label: string
  fields: DescribeField[]
}

// --- Object list mapping ---

/**
 * Convert a jsforce describeGlobal result into ConnectorObject[].
 * - Filters out non-queryable and deprecated objects outright.
 * - Keeps system objects in the list but flags them via `isSystemObject`
 *   (the UI decides whether to hide them by default).
 * - Sets `isSelected` based on `isDefaultSelected()` (custom + common CRM).
 */
export function mapDescribeGlobalToSchema(result: DescribeGlobalResult): ConnectorObject[] {
  return result.sobjects
    .filter((s) => s.queryable !== false && !s.deprecatedAndHidden)
    .map<ConnectorObject>((s) => ({
      apiName: s.name,
      label: s.label,
      description: isSystemObject(s.name) ? '[system]' : undefined,
      isCustom: s.custom,
      isSelected: isDefaultSelected(s.name, s.custom),
    }))
}

// --- Field mapping ---

/**
 * Derive the relationshipType of a Salesforce reference field.
 * Salesforce doesn't expose a direct flag; heuristic from research:
 * - `referenceTo.length === 1` and `cascadeDelete` semantics in `type==='reference'`
 *   → often ManyToOne.
 * - Salesforce doesn't expose ManyToMany at describe level (junction objects instead).
 * We simplify to ManyToOne for all non-null references (the mapping UI can refine).
 */
function inferRelationshipType(field: DescribeField): string | undefined {
  if (field.type !== 'reference') return undefined
  if (!field.referenceTo || field.referenceTo.length === 0) return undefined
  return 'ManyToOne'
}

/** Map a jsforce describe() result into ConnectorField[]. */
export function mapDescribeToFields(result: DescribeResult): ConnectorField[] {
  return result.fields.map<ConnectorField>((f) => ({
    apiName: f.name,
    label: f.label,
    dataType: normaliseType(f.type),
    isRequired: f.nillable === false && f.createable !== false,
    isReadOnly: f.createable === false && f.updateable === false,
    isUnique: f.unique === true,
    referenceTo: f.referenceTo && f.referenceTo.length > 0 ? f.referenceTo[0] : undefined,
    relationshipType: inferRelationshipType(f),
    description: f.inlineHelpText ?? undefined,
    picklistValues:
      f.picklistValues && f.picklistValues.length > 0
        ? f.picklistValues.filter((p) => p.active !== false).map((p) => p.value)
        : undefined,
  }))
}

/**
 * Normalise SF field types to the Carbo-v0 type vocabulary used by DemoSourceAdapter.
 * We keep SF-specific names when they have no clean analogue (e.g. `encryptedstring`),
 * so the mapping UI can flag them as "exotic".
 */
function normaliseType(sfType: string): string {
  switch (sfType) {
    case 'string':
    case 'textarea':
      return 'string'
    case 'phone':
      return 'phone'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'int':
    case 'integer':
      return 'integer'
    case 'double':
    case 'long':
    case 'decimal':
      return 'decimal'
    case 'currency':
      return 'currency'
    case 'percent':
      return 'percent'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'time':
      return 'time'
    case 'picklist':
    case 'multipicklist':
      return 'picklist'
    case 'reference':
      return 'reference'
    case 'id':
      return 'string'
    default:
      return sfType // encryptedstring, geolocation, address, base64, …
  }
}
