// HubSpot Adapter — implements ConnectorAdapter (v4 port)
// Ref: specs/adapters/hubspot/

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type {
  ConnectorAdapter,
  ConnectorCapabilities,
  ConnectorConnection,
  ConnectorField,
  ConnectorObject,
  ConnectorSchema,
  FieldModification,
  FieldStats,
  PaginatedRecords,
} from '@/lib/types/connector'
import {
  computeOAuthExpiresAt,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  refreshOAuthToken,
  validatePrivateAppToken,
} from './hubspot-auth'
import { getCustomObjects, getProperties, getStandardObjects } from './hubspot-schema'
import { countRecords, searchRecords, calculateFieldStats } from './hubspot-records'
import { createCustomObject, createProperty, modifyProperty } from './hubspot-schema-write'
import type { HubSpotConnectionConfig, PropertyCreateInput } from './hubspot-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the persisted HubSpot connection config from ConnectorConnection.config (v4 schema).
 * The v4 model uses adapterType/status/config (JSON string) / secretsRef on ConnectorConnection.
 */
async function loadConfig(connectionId: string): Promise<HubSpotConnectionConfig> {
  const record = await prisma.connectorConnection.findUnique({ where: { id: connectionId } })
  if (!record) throw new Error(`ConnectorConnection not found: ${connectionId}`)
  return JSON.parse(record.config) as HubSpotConnectionConfig
}

async function saveConfig(connectionId: string, c: HubSpotConnectionConfig): Promise<void> {
  await prisma.connectorConnection.update({
    where: { id: connectionId },
    data: { config: JSON.stringify(c) },
  })
}

async function getValidAccessToken(connectionId: string): Promise<string> {
  const c = await loadConfig(connectionId)
  if (c.authMethod === 'private-app') {
    return c.accessToken
  }
  // OAuth path: check expiration + refresh if needed.
  const expired = !c.tokenExpiresAt || new Date(c.tokenExpiresAt).getTime() <= Date.now()
  if (!expired) return c.accessToken

  const app = loadHubSpotOAuthConfig()
  const refreshed = await refreshOAuthToken(app, c.refreshToken)
  const next: HubSpotConnectionConfig = {
    ...c,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt: computeOAuthExpiresAt(refreshed.expires_in),
  }
  await saveConfig(connectionId, next)
  await logAuditEvent({ action: 'HS_TOKEN_REFRESHED', entity: 'ConnectorConnection', entityId: connectionId })
  return next.accessToken
}

/** Map a Carbo-v0 dataType back to the HubSpot property type vocabulary. */
function reverseNormaliseType(carboType: string): PropertyCreateInput['type'] {
  switch (carboType) {
    case 'string':
    case 'phone':
    case 'email':
    case 'url':
      return 'string'
    case 'integer':
    case 'decimal':
    case 'currency':
    case 'percent':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'picklist':
      return 'enumeration'
    case 'boolean':
      return 'bool'
    default:
      return 'string'
  }
}

// ---------------------------------------------------------------------------
// Adapter object
// ---------------------------------------------------------------------------

export const hubspotAdapter: ConnectorAdapter = {
  capabilities: {
    canRead: true,
    canWrite: false,
    canWriteSchema: true,
    supportedFieldTypes: ['string', 'number', 'date', 'datetime', 'enumeration', 'bool'],
  } satisfies ConnectorCapabilities,

  // ----- Connect / disconnect -----

  /**
   * Supports both auth modes:
   * - private-app: config = { accessToken }
   * - oauth2: config = { authMethod:'oauth2', accessToken, refreshToken, tokenExpiresAt, ... }
   *   already populated by the OAuth callback (route writes directly to ConnectorConnection).
   */
  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    const token = (config as { accessToken?: string }).accessToken
    if (!token) throw new HubSpotAuthError('Missing accessToken in config.')

    const portal = await validatePrivateAppToken(token)
    return {
      id: '',
      name: portal.portalName ?? `HubSpot portal ${portal.portalId}`,
      type: 'hubspot',
      status: 'CONNECTED',
      config: { ...config, portalId: portal.portalId, portalName: portal.portalName },
    }
  },

  async disconnect(_connectionId: string): Promise<void> {
    // Stateless — deletion handled by the service layer.
  },

  // ----- Schema -----

  async getSchema(connectionId: string): Promise<ConnectorSchema> {
    const token = await getValidAccessToken(connectionId)
    const standard = getStandardObjects()
    const custom = await getCustomObjects(token).catch((err) => {
      console.warn('[hubspot-adapter] custom objects fetch failed, continuing with standard only:', err)
      return [] as ConnectorObject[]
    })
    const objects = [...standard, ...custom]
    await logAuditEvent({
      action: 'HS_SCHEMA_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { standardCount: standard.length, customCount: custom.length },
    })
    return { objects }
  },

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    const token = await getValidAccessToken(connectionId)
    const fields = await getProperties(token, objectApiName)
    await logAuditEvent({
      action: 'HS_FIELDS_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, count: fields.length },
    })
    return fields
  },

  // ----- Records -----

  async getRecords(
    connectionId: string,
    objectApiName: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRecords> {
    const token = await getValidAccessToken(connectionId)
    // Fetch up to 25 property names to pass to the search, avoiding oversized requests.
    const fields = (await getProperties(token, objectApiName)).map((f) => f.apiName).slice(0, 25)
    const result = await searchRecords(token, connectionId, objectApiName, fields, page, pageSize)
    await logAuditEvent({
      action: 'HS_RECORDS_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, page, pageSize, returned: result.records.length },
    })
    return result
  },

  async getRecordCount(connectionId: string, objectApiName: string): Promise<number> {
    const token = await getValidAccessToken(connectionId)
    return countRecords(token, objectApiName)
  },

  async getFieldStats(
    connectionId: string,
    objectApiName: string,
    fieldApiNames: string[],
  ): Promise<FieldStats[]> {
    const token = await getValidAccessToken(connectionId)
    // Fetch a sample page (100 records max) to compute local stats.
    const result = await searchRecords(token, connectionId, objectApiName, fieldApiNames, 1, 100)
    return fieldApiNames.map((fieldApiName) =>
      calculateFieldStats(result.records, fieldApiName),
    )
  },

  // ----- Schema write -----

  async createObject(
    connectionId: string,
    object: { apiName: string; label: string; description?: string },
  ): Promise<ConnectorObject> {
    const token = await getValidAccessToken(connectionId)
    const out = await createCustomObject(token, {
      name: object.apiName,
      labels: { singular: object.label, plural: `${object.label}s` },
      primaryDisplayProperty: 'name',
      properties: [{ name: 'name', label: 'Name', type: 'string', fieldType: 'text' }],
      requiredProperties: ['name'],
      searchableProperties: ['name'],
    })
    await logAuditEvent({
      action: 'HS_CUSTOM_OBJECT_CREATED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { apiName: object.apiName },
    })
    return out
  },

  async createField(
    connectionId: string,
    objectApiName: string,
    field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>,
  ): Promise<ConnectorField> {
    const token = await getValidAccessToken(connectionId)
    const input: PropertyCreateInput = {
      name: field.apiName,
      label: field.label,
      type: reverseNormaliseType(field.dataType),
      fieldType: '', // left to createProperty's default
      options: field.picklistValues?.map((v) => ({ label: v, value: v })),
    }
    const out = await createProperty(token, objectApiName, input)
    await logAuditEvent({
      action: 'HS_PROPERTY_CREATED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, name: field.apiName },
    })
    return out
  },

  async modifyField(
    connectionId: string,
    objectApiName: string,
    fieldApiName: string,
    updates: FieldModification,
  ): Promise<ConnectorField> {
    const token = await getValidAccessToken(connectionId)
    const out = await modifyProperty(token, objectApiName, fieldApiName, updates)
    await logAuditEvent({
      action: 'HS_PROPERTY_MODIFIED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, field: fieldApiName, updates },
    })
    return out
  },
}
