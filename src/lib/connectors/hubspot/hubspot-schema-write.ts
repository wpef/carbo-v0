// HubSpot — schema write (create property, create custom object)
// Ref: specs/adapters/hubspot/ (T009)

import {
  CREATABLE_PROPERTY_TYPES,
  DEFAULT_PROPERTY_GROUPS,
  HS_API_BASE,
  TYPE_TO_FIELD_TYPE,
} from './hubspot-constants'
import type { CreatablePropertyType, ObjectCreateInput, PropertyCreateInput } from './hubspot-types'
import type { ConnectorField, ConnectorObject } from '@/lib/connectors/types'
import { getProperties } from './hubspot-schema'

// --- Errors ---

export class PropertyAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Property '${name}' already exists on this object.`)
    this.name = 'PropertyAlreadyExistsError'
  }
}

export class InvalidPropertyTypeError extends Error {
  constructor(type: string) {
    super(`Property type '${type}' is not creatable via Carbo-v0.`)
    this.name = 'InvalidPropertyTypeError'
  }
}

export class EnterpriseRequiredError extends Error {
  constructor() {
    super('Creating custom objects requires a HubSpot Enterprise tier portal.')
    this.name = 'EnterpriseRequiredError'
  }
}

// --- Validation helpers ---

function assertCreatableType(type: string): asserts type is CreatablePropertyType {
  if (!CREATABLE_PROPERTY_TYPES.includes(type as CreatablePropertyType)) {
    throw new InvalidPropertyTypeError(type)
  }
}

// --- Create a property on an existing object ---

/**
 * Create a new property on an existing HubSpot object.
 * - Validates type locally against CREATABLE_PROPERTY_TYPES.
 * - Checks name uniqueness against the current object properties.
 * - POSTs to /crm/v3/properties/{objectType}.
 */
export async function createProperty(
  accessToken: string,
  objectType: string,
  input: PropertyCreateInput,
): Promise<ConnectorField> {
  assertCreatableType(input.type)

  // Name uniqueness — refresh the cached schema to avoid races with concurrent creations.
  const existing = await getProperties(accessToken, objectType)
  if (existing.some((p) => p.apiName === input.name)) {
    throw new PropertyAlreadyExistsError(input.name)
  }

  const body: Record<string, unknown> = {
    name: input.name,
    label: input.label,
    type: input.type,
    fieldType: input.fieldType || TYPE_TO_FIELD_TYPE[input.type] || 'text',
    groupName: input.groupName || DEFAULT_PROPERTY_GROUPS[objectType] || 'custom',
    description: input.description,
  }
  if (input.type === 'enumeration') {
    if (!input.options || input.options.length === 0) {
      throw new InvalidPropertyTypeError('enumeration requires at least one option')
    }
    body.options = input.options
  }

  const res = await fetch(`${HS_API_BASE}/crm/v3/properties/${encodeURIComponent(objectType)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await safeJson(res)
    throw new Error(
      `HubSpot property create failed (${res.status}): ${(err as { message?: string })?.message ?? res.statusText}`,
    )
  }

  const p = (await res.json()) as {
    name: string
    label: string
    type: string
    description?: string
    groupName?: string
  }
  return {
    apiName: p.name,
    label: p.label,
    dataType: p.type,
    isRequired: false,
    isReadOnly: false,
    isUnique: false,
    description: p.description,
    group: p.groupName,
  }
}

// --- Create a custom object ---

export async function createCustomObject(
  accessToken: string,
  def: ObjectCreateInput,
): Promise<ConnectorObject> {
  // Basic type validation on embedded properties.
  for (const prop of def.properties) {
    assertCreatableType(prop.type)
  }

  const body: Record<string, unknown> = {
    name: def.name,
    labels: def.labels,
    primaryDisplayProperty: def.primaryDisplayProperty,
    properties: def.properties.map((p) => ({
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType || TYPE_TO_FIELD_TYPE[p.type] || 'text',
      ...(p.options ? { options: p.options } : {}),
    })),
    ...(def.requiredProperties ? { requiredProperties: def.requiredProperties } : {}),
    ...(def.searchableProperties ? { searchableProperties: def.searchableProperties } : {}),
  }

  const res = await fetch(`${HS_API_BASE}/crm/v3/schemas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 403) {
    throw new EnterpriseRequiredError()
  }
  if (!res.ok) {
    const err = await safeJson(res)
    throw new Error(
      `HubSpot custom object create failed (${res.status}): ${(err as { message?: string })?.message ?? res.statusText}`,
    )
  }

  const o = (await res.json()) as {
    name: string
    labels?: { plural?: string }
    description?: string
  }
  return {
    apiName: o.name,
    label: o.labels?.plural ?? o.name,
    description: o.description ?? 'Custom object (created via Carbo-v0)',
    isCustom: true,
    isSelected: true,
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}
