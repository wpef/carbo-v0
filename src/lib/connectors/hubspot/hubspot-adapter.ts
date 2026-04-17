// HubSpot Adapter — implements ConnectorAdapter
// Ref: specs/adapters/hubspot/ (T010)

import { prisma } from '@/lib/db/prisma'
import { logAction } from '@/lib/services/audit-service'
import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorField,
  ConnectorObject,
  ConnectorSchema,
  FieldStats,
  PaginatedRecords,
} from '@/lib/connectors/types'
import {
  computeOAuthExpiresAt,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  refreshOAuthToken,
  validatePrivateAppToken,
} from './hubspot-auth'
import { getCustomObjects, getProperties, getStandardObjects } from './hubspot-schema'
import {
  countRecords,
  searchRecords,
  calculateFieldStats,
} from './hubspot-records'
import { createCustomObject, createProperty } from './hubspot-schema-write'
import type { HubSpotConnectionConfig, PropertyCreateInput } from './hubspot-types'

export class HubSpotAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = false
  readonly canWriteSchema = true

  // ----- Connect / disconnect -----

  /**
   * Supports both auth modes:
   * - private-app: config = { accessToken } — validates via /account-info/v3/details
   * - oauth2: config = { authMethod:'oauth2', accessToken, refreshToken, tokenExpiresAt, ... }
   *   already populated by the OAuth callback.
   */
  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    // Private App path: just an accessToken in config.
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
  }

  async disconnect(_connectionId: string): Promise<void> {
    // Stateless — deletion in service layer.
  }

  // ----- Internal helpers -----

  private async loadConfig(connectionId: string): Promise<HubSpotConnectionConfig> {
    const record = await prisma.destinationConnection.findUnique({ where: { id: connectionId } })
    if (!record) throw new Error(`DestinationConnection not found: ${connectionId}`)
    return JSON.parse(record.config) as HubSpotConnectionConfig
  }

  private async saveConfig(connectionId: string, c: HubSpotConnectionConfig): Promise<void> {
    await prisma.destinationConnection.update({
      where: { id: connectionId },
      data: { config: JSON.stringify(c) },
    })
  }

  private async getValidAccessToken(connectionId: string): Promise<string> {
    const c = await this.loadConfig(connectionId)
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
    await this.saveConfig(connectionId, next)
    await logAudit(connectionId, 'HS_TOKEN_REFRESHED')
    return next.accessToken
  }

  // ----- Schema -----

  async getSchema(connectionId: string): Promise<ConnectorSchema> {
    const token = await this.getValidAccessToken(connectionId)
    const standard = getStandardObjects()
    const custom = await getCustomObjects(token).catch((err) => {
      console.warn('[hubspot-adapter] custom objects fetch failed, continuing with standard only:', err)
      return [] as ConnectorObject[]
    })
    const objects = [...standard, ...custom]
    await logAudit(connectionId, 'HS_SCHEMA_FETCHED', {
      standardCount: standard.length,
      customCount: custom.length,
    })
    return { objects }
  }

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    const token = await this.getValidAccessToken(connectionId)
    const fields = await getProperties(token, objectApiName)
    await logAudit(connectionId, 'HS_FIELDS_FETCHED', { object: objectApiName, count: fields.length })
    return fields
  }

  // ----- Records -----

  async getRecords(
    connectionId: string,
    objectApiName: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRecords> {
    const token = await this.getValidAccessToken(connectionId)
    const fields = (await getProperties(token, objectApiName)).map((f) => f.apiName).slice(0, 25)
    const result = await searchRecords(token, connectionId, objectApiName, fields, page, pageSize)
    await logAudit(connectionId, 'HS_RECORDS_FETCHED', {
      object: objectApiName,
      page,
      pageSize,
      returned: result.records.length,
    })
    return result
  }

  async getRecordCount(connectionId: string, objectApiName: string): Promise<number> {
    const token = await this.getValidAccessToken(connectionId)
    return countRecords(token, objectApiName)
  }

  async getFieldStats(
    connectionId: string,
    objectApiName: string,
    fieldApiName: string,
  ): Promise<FieldStats> {
    const token = await this.getValidAccessToken(connectionId)
    const r = await searchRecords(token, connectionId, objectApiName, [fieldApiName], 0, 100)
    return calculateFieldStats(r.records, fieldApiName)
  }

  // ----- Schema write -----

  async createObject(connectionId: string, apiName: string, label: string): Promise<ConnectorObject> {
    const token = await this.getValidAccessToken(connectionId)
    const out = await createCustomObject(token, {
      name: apiName,
      labels: { singular: label, plural: `${label}s` },
      primaryDisplayProperty: 'name',
      properties: [{ name: 'name', label: 'Name', type: 'string', fieldType: 'text' }],
      requiredProperties: ['name'],
      searchableProperties: ['name'],
    })
    await logAudit(connectionId, 'HS_CUSTOM_OBJECT_CREATED', { apiName })
    return out
  }

  async createField(
    connectionId: string,
    objectApiName: string,
    field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>,
  ): Promise<ConnectorField> {
    const token = await this.getValidAccessToken(connectionId)
    // Map the ConnectorField's Carbo type back to HubSpot's property type vocabulary.
    const input: PropertyCreateInput = {
      name: field.apiName,
      label: field.label,
      type: reverseNormaliseType(field.dataType),
      fieldType: '', // left to the createProperty default
      description: field.description,
      options: field.picklistValues?.map((v) => ({ label: v, value: v })),
    }
    const out = await createProperty(token, objectApiName, input)
    await logAudit(connectionId, 'HS_PROPERTY_CREATED', { object: objectApiName, name: field.apiName })
    return out
  }
}

function reverseNormaliseType(
  carboType: string,
): PropertyCreateInput['type'] {
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

async function logAudit(connectionId: string, action: string, details?: Record<string, unknown>) {
  const connection = await prisma.destinationConnection.findUnique({ where: { id: connectionId } })
  await logAction(connection?.planId ?? null, action, { connectionId, ...details })
}
