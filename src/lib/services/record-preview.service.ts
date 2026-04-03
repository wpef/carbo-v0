// 009-record-preview — Record preview service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { getAdapterInstance } from '@/lib/connectors/adapter-factory'
import type { PaginatedRecords } from '@/lib/connectors/types'

// --- Errors ---

export class RecordPreviewPlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan not found: ${planId}`)
    this.name = 'RecordPreviewPlanNotFoundError'
  }
}

export class RecordPreviewConnectionNotFoundError extends Error {
  constructor(planId: string, role: string) {
    super(`No ${role} connection found for plan: ${planId}`)
    this.name = 'RecordPreviewConnectionNotFoundError'
  }
}

export class RecordPreviewConnectionNotConnectedError extends Error {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} is not in CONNECTED status`)
    this.name = 'RecordPreviewConnectionNotConnectedError'
  }
}

// --- Helpers ---

async function resolveConnection(planId: string, role: 'source' | 'destination') {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new RecordPreviewPlanNotFoundError(planId)

  const conn =
    role === 'source'
      ? await prisma.sourceConnection.findUnique({ where: { planId } })
      : await prisma.destinationConnection.findUnique({ where: { planId } })

  if (!conn) throw new RecordPreviewConnectionNotFoundError(planId, role)
  if (conn.status !== 'CONNECTED') throw new RecordPreviewConnectionNotConnectedError(conn.id)

  return conn
}

// --- Service functions ---

/**
 * Fetch a paginated page of records for an object via the adapter.
 * Binary fields (Buffer values) are replaced with the placeholder "[binary data]".
 * Logs to audit trail.
 */
export async function getRecordPreview(
  planId: string,
  role: 'source' | 'destination',
  objectApiName: string,
  page: number,
  pageSize: number,
): Promise<PaginatedRecords> {
  const conn = await resolveConnection(planId, role)
  const adapter = getAdapterInstance(conn.adapterType)

  const result = await adapter.getRecords(conn.id, objectApiName, page, pageSize)

  // Replace binary values with a placeholder so they serialise cleanly as JSON
  const sanitised = result.records.map((record) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(record)) {
      if (v instanceof Uint8Array || Buffer.isBuffer(v)) {
        out[k] = '[binary data]'
      } else {
        out[k] = v
      }
    }
    return out
  })

  await logAction(planId, 'RECORDS_PREVIEWED', {
    role,
    objectApiName,
    page,
    pageSize,
    count: sanitised.length,
  })

  return { ...result, records: sanitised }
}

/**
 * Return the total record count for an object via the adapter.
 */
export async function getRecordCount(
  planId: string,
  role: 'source' | 'destination',
  objectApiName: string,
): Promise<number> {
  const conn = await resolveConnection(planId, role)
  const adapter = getAdapterInstance(conn.adapterType)
  return adapter.getRecordCount(conn.id, objectApiName)
}
