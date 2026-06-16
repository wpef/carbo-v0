// 009-record-preview — Record preview service
// Fetches paginated records and sanitises binary values ([binary data] placeholder).
// Logs RECORDS_PREVIEWED to the audit trail (FR-008).

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'
import type { SnapshotSide } from '@prisma/client'
import type { PaginatedRecords } from '@/lib/types/connector'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RecordPreviewPlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plan not found: ${planId}`)
    this.name = 'RecordPreviewPlanNotFoundError'
  }
}

export class RecordPreviewConnectionNotFoundError extends Error {
  constructor(planId: string, side: string) {
    super(`No ${side.toLowerCase()} connection found for plan: ${planId}`)
    this.name = 'RecordPreviewConnectionNotFoundError'
  }
}

export class RecordPreviewConnectionNotConnectedError extends Error {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} is not in CONNECTED status`)
    this.name = 'RecordPreviewConnectionNotConnectedError'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveConnection(planId: string, side: SnapshotSide) {
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  })
  if (!plan) throw new RecordPreviewPlanNotFoundError(planId)

  const conn = side === 'SOURCE' ? plan.sourceConnection : plan.destinationConnection
  if (!conn) throw new RecordPreviewConnectionNotFoundError(planId, side)
  if (conn.status !== 'CONNECTED') throw new RecordPreviewConnectionNotConnectedError(conn.id)

  return conn
}

/** Replace Buffer / Uint8Array values with "[binary data]" placeholder (FR-009). */
function sanitiseBinary(records: Record<string, unknown>[]): Record<string, unknown>[] {
  return records.map((record) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(record)) {
      if (v instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(v))) {
        out[k] = '[binary data]'
      } else {
        out[k] = v
      }
    }
    return out
  })
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated page of records for an object via the adapter.
 * Binary fields are replaced with "[binary data]". Audit log emitted.
 * Default pageSize: 50 (spec FR-002).
 */
export async function fetchRecordPage(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
  page: number,
  pageSize: number = 50,
): Promise<PaginatedRecords> {
  const conn = await resolveConnection(planId, side)
  const adapter = getAdapter(conn.adapterType)

  const result = await adapter.getRecords(conn.id, objectApiName, page, pageSize)
  const sanitised = sanitiseBinary(result.records)

  await logAuditEvent({
    planId,
    action: 'RECORDS_PREVIEWED',
    entity: 'ConnectorRecord',
    details: {
      side,
      objectApiName,
      page,
      pageSize,
      count: sanitised.length,
    },
  })

  return { ...result, records: sanitised }
}

/**
 * Return the total record count for an object via the adapter.
 */
export async function fetchRecordCount(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
): Promise<number> {
  const conn = await resolveConnection(planId, side)
  const adapter = getAdapter(conn.adapterType)
  return adapter.getRecordCount(conn.id, objectApiName)
}

/**
 * Fetch field stats for named fields from the adapter (used by the records endpoint).
 */
export async function fetchFieldStats(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
  fieldApiNames: string[],
) {
  const conn = await resolveConnection(planId, side)
  const adapter = getAdapter(conn.adapterType)
  return adapter.getFieldStats(conn.id, objectApiName, fieldApiNames)
}

/**
 * Expand an object: record count, fields, and up to 5 sample records in parallel.
 * Used by the /expand endpoint (cluster 9).
 */
export async function expandObject(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
) {
  const conn = await resolveConnection(planId, side)
  const adapter = getAdapter(conn.adapterType)

  const [recordCount, fields, paginated] = await Promise.all([
    adapter.getRecordCount(conn.id, objectApiName),
    adapter.getFields(conn.id, objectApiName),
    adapter.getRecords(conn.id, objectApiName, 1, 5),
  ])

  const sampleRecords = sanitiseBinary(paginated.records)

  return { objectApiName, recordCount, fields, sampleRecords }
}
