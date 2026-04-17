// HubSpot — schema retrieval (standard + custom objects + properties)
// Ref: specs/adapters/hubspot/ (T007)

import { HS_API_BASE } from './hubspot-constants'
import type { ConnectorField, ConnectorObject } from '@/lib/connectors/types'
import { STANDARD_OBJECTS } from './hubspot-constants'

// --- Minimal shapes we rely on from HubSpot ---

interface HSProperty {
  name: string
  label: string
  type: string // 'string' | 'number' | 'date' | 'datetime' | 'enumeration' | 'bool' | …
  fieldType?: string
  description?: string
  groupName?: string
  modificationMetadata?: { readOnlyValue?: boolean; readOnlyDefinition?: boolean }
  hasUniqueValue?: boolean
  options?: Array<{ label: string; value: string }>
  hubspotDefined?: boolean
}

interface HSPropertiesResponse {
  results: HSProperty[]
}

interface HSSchemaResponse {
  results: Array<{
    name: string
    labels: { singular: string; plural: string }
    objectTypeId: string
    fullyQualifiedName?: string
    description?: string
    archived?: boolean
  }>
}

// --- Standard objects ---

export function getStandardObjects(): ConnectorObject[] {
  return STANDARD_OBJECTS.map<ConnectorObject>((o) => ({
    apiName: o.apiName,
    label: o.label,
    description: o.description,
    isCustom: false,
    isSelected: true, // standard objects are pre-selected by default
  }))
}

// --- Custom objects (graceful degradation when not Enterprise) ---

/**
 * Fetch custom objects defined in the portal via the Schemas API.
 * Returns `[]` on 403 (tier limitation) rather than throwing — spec FR-004.
 */
export async function getCustomObjects(accessToken: string): Promise<ConnectorObject[]> {
  const res = await fetch(`${HS_API_BASE}/crm/v3/schemas`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (res.status === 403 || res.status === 404) {
    // Tier limitation — graceful degradation.
    console.log('[hubspot-schema] Custom objects unavailable (not Enterprise tier).')
    return []
  }
  if (!res.ok) {
    throw new Error(`HubSpot schemas API failed (${res.status}): ${res.statusText}`)
  }

  const data = (await res.json()) as HSSchemaResponse
  return data.results
    .filter((s) => !s.archived)
    .map<ConnectorObject>((s) => ({
      apiName: s.name,
      label: s.labels?.plural ?? s.name,
      description: s.description ?? 'Custom object',
      isCustom: true,
      isSelected: true,
    }))
}

// --- Properties (fields of an object) ---

export async function getProperties(accessToken: string, objectType: string): Promise<ConnectorField[]> {
  const res = await fetch(`${HS_API_BASE}/crm/v3/properties/${encodeURIComponent(objectType)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`HubSpot properties fetch failed (${res.status}) for ${objectType}: ${res.statusText}`)
  }

  const data = (await res.json()) as HSPropertiesResponse
  return data.results.map<ConnectorField>((p) => ({
    apiName: p.name,
    label: p.label,
    dataType: normaliseType(p.type),
    isRequired: false, // HubSpot doesn't flag a property as globally required on objects.
    isReadOnly: p.modificationMetadata?.readOnlyValue === true,
    isUnique: p.hasUniqueValue === true,
    description: p.description,
    group: p.groupName,
    picklistValues:
      p.type === 'enumeration' && p.options && p.options.length > 0
        ? p.options.map((o) => o.value)
        : undefined,
  }))
}

/** Map HubSpot property type -> Carbo-v0 vocabulary (same vocabulary as DemoSourceAdapter). */
function normaliseType(hsType: string): string {
  switch (hsType) {
    case 'string':
      return 'string'
    case 'number':
      return 'decimal'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'enumeration':
      return 'picklist'
    case 'bool':
      return 'boolean'
    case 'phone_number':
      return 'phone'
    default:
      return hsType
  }
}
