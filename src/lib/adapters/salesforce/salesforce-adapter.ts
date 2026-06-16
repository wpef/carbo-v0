// Salesforce Adapter — implements ConnectorAdapter using jsforce v3 (v4 port)
// Ref: specs/adapters/salesforce/

import jsforce from 'jsforce'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type {
  ConnectorAdapter,
  ConnectorCapabilities,
  ConnectorConnection,
  ConnectorField,
  ConnectorSchema,
  FieldStats,
  PaginatedRecords,
} from '@/lib/types/connector'
import {
  computeExpiresAt,
  fetchIdentity,
  loadSalesforceConfig,
  refreshAccessToken,
  SalesforceAuthError,
} from './salesforce-auth'
import { mapDescribeGlobalToSchema, mapDescribeToFields, type DescribeResult } from './salesforce-schema'
import {
  buildCountQuery,
  buildSoqlQuery,
  calculateFieldStats,
  executeQuery,
} from './salesforce-records'
import { SF_API_VERSION } from './salesforce-constants'
import type { SalesforceConnectionConfig } from './salesforce-types'

// ----- Internal: load connection config from v4 ConnectorConnection model -----

async function loadConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
  const record = await prisma.connectorConnection.findUnique({ where: { id: connectionId } })
  if (!record) throw new Error(`ConnectorConnection not found: ${connectionId}`)
  return JSON.parse(record.config) as SalesforceConnectionConfig
}

async function saveConfig(connectionId: string, c: SalesforceConnectionConfig): Promise<void> {
  await prisma.connectorConnection.update({
    where: { id: connectionId },
    data: { config: JSON.stringify(c) },
  })
}

function isExpired(c: SalesforceConnectionConfig): boolean {
  return !c.tokenExpiresAt || new Date(c.tokenExpiresAt).getTime() <= Date.now()
}

/**
 * Ensure we hold a valid access token. If the stored one has expired and a
 * refresh token is available, refresh transparently and persist the new pair.
 */
async function getValidConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
  const c = await loadConfig(connectionId)
  if (!isExpired(c)) return c

  if (!c.refreshToken) {
    throw new SalesforceAuthError('Access token expired and no refresh_token available.')
  }
  const app = loadSalesforceConfig()
  const refreshed = await refreshAccessToken(app, c.refreshToken)
  const next: SalesforceConnectionConfig = {
    ...c,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? c.refreshToken,
    tokenExpiresAt: computeExpiresAt(refreshed.issued_at),
    instanceUrl: refreshed.instance_url ?? c.instanceUrl,
  }
  await saveConfig(connectionId, next)
  await logAuditEvent({ action: 'SF_TOKEN_REFRESHED', entity: 'ConnectorConnection', entityId: connectionId })
  return next
}

/** Build a jsforce Connection from the current (valid) config. */
async function getJsforceConn(connectionId: string): Promise<InstanceType<typeof jsforce.Connection>> {
  const c = await getValidConfig(connectionId)
  return new jsforce.Connection({
    instanceUrl: c.instanceUrl,
    accessToken: c.accessToken,
    version: SF_API_VERSION,
  })
}

// ----- Adapter implementation -----

const capabilities: ConnectorCapabilities = {
  canRead: true,
  canWrite: false,
  canWriteSchema: false,
}

export const salesforceAdapter: ConnectorAdapter = {
  capabilities,

  /**
   * `connect()` is called when the OAuth callback has already obtained tokens.
   * Config must contain { accessToken, instanceUrl } at minimum.
   * For Salesforce, the OAuth route creates the ConnectorConnection directly;
   * this method validates and returns the typed connection shape.
   */
  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    const c = config as Partial<SalesforceConnectionConfig>
    if (!c.accessToken || !c.instanceUrl) {
      throw new SalesforceAuthError('Missing accessToken/instanceUrl in config.')
    }
    // Best-effort identity revalidation.
    const idUrl = (config as { id?: string }).id
    if (idUrl) {
      await fetchIdentity(idUrl, c.accessToken).catch(() => undefined)
    }
    return {
      id: '', // filled by the persistence layer
      name: c.orgName ?? 'Salesforce',
      type: 'salesforce',
      status: 'CONNECTED',
      config,
    }
  },

  async disconnect(_connectionId: string): Promise<void> {
    // Stateless per-adapter; ConnectorConnection deletion/status update handled by service layer.
  },

  // ----- Schema -----

  async getSchema(connectionId: string): Promise<ConnectorSchema> {
    const conn = await getJsforceConn(connectionId)
    const result = await conn.describeGlobal()
    const objects = mapDescribeGlobalToSchema({ sobjects: result.sobjects })
    await logAuditEvent({
      action: 'SF_SCHEMA_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { objectCount: objects.length },
    })
    return { objects }
  },

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    const conn = await getJsforceConn(connectionId)
    const desc = (await conn.describe(objectApiName)) as unknown as DescribeResult
    const fields = mapDescribeToFields(desc)
    await logAuditEvent({
      action: 'SF_FIELDS_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, fieldCount: fields.length },
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
    const conn = await getJsforceConn(connectionId)

    // Fetch the field list lazily to pick the column set for the preview query.
    const fields = await salesforceAdapter.getFields(connectionId, objectApiName)
    const fieldNames = fields
      .filter((f) => f.isAccessible !== false && f.dataType !== 'reference')
      .concat(fields.filter((f) => f.apiName === 'Id'))
      // deduplicate Id if already present
      .filter((f, i, arr) => arr.findIndex((x) => x.apiName === f.apiName) === i)
      .slice(0, 20)
      .map((f) => f.apiName)

    const soql = buildSoqlQuery(objectApiName, fieldNames, page, pageSize)
    const countQ = buildCountQuery(objectApiName)

    const countResult = await (conn.query(countQ) as unknown as Promise<{ totalSize: number }>).catch(() => ({ totalSize: 0 }))
    const totalCount = countResult.totalSize

    const result = await executeQuery(
      conn as unknown as { query: (s: string) => Promise<{ totalSize: number; done: boolean; records: Record<string, unknown>[] }> },
      soql,
      page,
      pageSize,
      totalCount,
    )

    await logAuditEvent({
      action: 'SF_RECORDS_FETCHED',
      entity: 'ConnectorConnection',
      entityId: connectionId,
      details: { object: objectApiName, page, pageSize, returned: result.records.length, totalCount },
    })
    return result
  },

  async getRecordCount(connectionId: string, objectApiName: string): Promise<number> {
    const conn = await getJsforceConn(connectionId)
    const r = await conn.query(buildCountQuery(objectApiName))
    return r.totalSize
  },

  async getFieldStats(
    connectionId: string,
    objectApiName: string,
    fieldApiNames: string[],
  ): Promise<FieldStats[]> {
    const conn = await getJsforceConn(connectionId)
    // Sample up to 200 records and compute stats locally per field.
    const soql = buildSoqlQuery(objectApiName, [...fieldApiNames, 'Id'].filter((v, i, a) => a.indexOf(v) === i), 1, 200)
    const r = await conn.query(soql)
    const records = (r.records ?? []).map((rec) => {
      const { attributes: _a, ...rest } = rec as Record<string, unknown> & { attributes?: unknown }
      return rest
    })
    return fieldApiNames.map((fieldApiName) => calculateFieldStats(records, fieldApiName))
  },
}
