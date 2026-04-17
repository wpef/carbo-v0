// Salesforce Adapter — implements ConnectorAdapter using jsforce v3
// Ref: specs/adapters/salesforce/ (T009)

import jsforce from 'jsforce'
import { prisma } from '@/lib/db/prisma'
import { logAction } from '@/lib/services/audit-service'
import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorField,
  ConnectorSchema,
  FieldStats,
  PaginatedRecords,
} from '@/lib/connectors/types'
import {
  computeExpiresAt,
  fetchIdentity,
  loadSalesforceConfig,
  refreshAccessToken,
  SalesforceAuthError,
} from './salesforce-auth'
import { mapDescribeGlobalToSchema, mapDescribeToFields } from './salesforce-schema'
import {
  buildCountQuery,
  buildSoqlQuery,
  calculateFieldStats,
  executeQuery,
} from './salesforce-records'
import { SF_API_VERSION } from './salesforce-constants'
import type { SalesforceConnectionConfig } from './salesforce-types'

export class SalesforceAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = false
  readonly canWriteSchema = false

  // ----- Connect / disconnect -----

  /**
   * `connect()` is called when the user form posts credentials. For Salesforce we use
   * OAuth2 instead (see /api/connectors/salesforce/auth + /callback) which persists
   * the connection directly via `upsertSourceConnectionRaw`. Calling `connect()` with
   * the already-obtained token config is still supported (re-validates the token).
   */
  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    const c = config as Partial<SalesforceConnectionConfig>
    if (!c.accessToken || !c.instanceUrl) {
      throw new SalesforceAuthError('Missing accessToken/instanceUrl in config.')
    }
    // Best-effort revalidation via identity endpoint.
    const id = (config as { id?: string }).id
    if (id) {
      await fetchIdentity(id, c.accessToken).catch(() => undefined)
    }
    return {
      id: '', // filled by the persistence layer
      name: c.orgName ?? 'Salesforce',
      type: 'salesforce',
      status: 'CONNECTED',
      config,
    }
  }

  async disconnect(_connectionId: string): Promise<void> {
    // Stateless per-adapter; deletion happens in the service layer.
  }

  // ----- Internal: load connection + refresh token if needed -----

  private async loadConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
    const record = await prisma.sourceConnection.findUnique({ where: { id: connectionId } })
    if (!record) throw new Error(`SourceConnection not found: ${connectionId}`)
    const c = JSON.parse(record.config) as SalesforceConnectionConfig
    return c
  }

  private async saveConfig(connectionId: string, c: SalesforceConnectionConfig): Promise<void> {
    await prisma.sourceConnection.update({
      where: { id: connectionId },
      data: { config: JSON.stringify(c) },
    })
  }

  private isExpired(c: SalesforceConnectionConfig): boolean {
    return !c.tokenExpiresAt || new Date(c.tokenExpiresAt).getTime() <= Date.now()
  }

  /**
   * Ensure we hold a valid access token. If the stored one has expired and a
   * refresh token is available, refresh transparently and persist the new pair.
   */
  private async getValidConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
    const c = await this.loadConfig(connectionId)
    if (!this.isExpired(c)) return c

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
    await this.saveConfig(connectionId, next)
    await logAudit(connectionId, 'SF_TOKEN_REFRESHED')
    return next
  }

  /** Build a jsforce Connection from the current (valid) config. */
  private async getJsforceConn(connectionId: string): Promise<InstanceType<typeof jsforce.Connection>> {
    const c = await this.getValidConfig(connectionId)
    return new jsforce.Connection({
      instanceUrl: c.instanceUrl,
      accessToken: c.accessToken,
      version: SF_API_VERSION,
    })
  }

  // ----- Schema -----

  async getSchema(connectionId: string): Promise<ConnectorSchema> {
    const conn = await this.getJsforceConn(connectionId)
    const result = await conn.describeGlobal()
    const objects = mapDescribeGlobalToSchema({ sobjects: result.sobjects })
    await logAudit(connectionId, 'SF_SCHEMA_FETCHED', { objectCount: objects.length })
    return { objects }
  }

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    const conn = await this.getJsforceConn(connectionId)
    const desc = (await conn.describe(objectApiName)) as unknown as Parameters<typeof mapDescribeToFields>[0]
    const fields = mapDescribeToFields(desc)
    await logAudit(connectionId, 'SF_FIELDS_FETCHED', {
      object: objectApiName,
      fieldCount: fields.length,
    })
    return fields
  }

  // ----- Records -----

  async getRecords(
    connectionId: string,
    objectApiName: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedRecords> {
    const conn = await this.getJsforceConn(connectionId)

    // Fetch the field list lazily to pick the column set for the preview query.
    const fields = await this.getFields(connectionId, objectApiName)
    const fieldNames = fields
      .filter((f) => f.dataType !== 'reference' || f.apiName === 'Id')
      .slice(0, 20) // cap preview columns
      .map((f) => f.apiName)

    const soql = buildSoqlQuery(objectApiName, fieldNames, page, pageSize)
    const countQ = buildCountQuery(objectApiName)
    const countResult = await conn.query(countQ).catch(() => ({ totalSize: 0, done: true, records: [] as Array<Record<string, unknown>> }))
    const totalCount = countResult.totalSize

    const result = await executeQuery(
      conn as unknown as { query: (s: string) => Promise<{ totalSize: number; done: boolean; records: Record<string, unknown>[] }> },
      soql,
      page,
      pageSize,
      totalCount,
    )
    await logAudit(connectionId, 'SF_RECORDS_FETCHED', {
      object: objectApiName,
      page,
      pageSize,
      returned: result.records.length,
    })
    return result
  }

  async getRecordCount(connectionId: string, objectApiName: string): Promise<number> {
    const conn = await this.getJsforceConn(connectionId)
    const r = await conn.query(buildCountQuery(objectApiName))
    return r.totalSize
  }

  async getFieldStats(
    connectionId: string,
    objectApiName: string,
    fieldApiName: string,
  ): Promise<FieldStats> {
    // Sample up to 200 records and compute stats locally.
    const conn = await this.getJsforceConn(connectionId)
    const soql = buildSoqlQuery(objectApiName, [fieldApiName, 'Id'], 0, 200)
    const r = await conn.query(soql)
    return calculateFieldStats(
      r.records.map((rec) => {
        const { attributes: _a, ...rest } = rec as Record<string, unknown> & { attributes?: unknown }
        return rest
      }),
      fieldApiName,
    )
  }
}

async function logAudit(connectionId: string, action: string, details?: Record<string, unknown>) {
  const connection = await prisma.sourceConnection.findUnique({ where: { id: connectionId } })
  await logAction(connection?.planId ?? null, action, { connectionId, ...details })
}
