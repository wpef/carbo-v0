// Salesforce — SOQL query building + field stats
// Ref: specs/adapters/salesforce/ (T008)

import type { ConnectorRecord, FieldStats, PaginatedRecords } from '@/lib/connectors/types'

/** Guard an identifier against injection in SOQL (allow only letters/digits/underscore). */
function safeIdent(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Invalid SF identifier: ${value}`)
  return value
}

/**
 * Build a SOQL query with LIMIT/OFFSET. Caller must have sanitised `objectApiName`
 * and `fieldApiNames` (we re-check here via safeIdent).
 *
 * `page` is **1-indexed** (page=1 → OFFSET 0). This matches the convention used
 * by the demo adapters and the API route (which requires page >= 1). The previous
 * 0-indexed math caused records to be silently skipped on page 1 (live test 2026-05-12).
 */
export function buildSoqlQuery(
  objectApiName: string,
  fieldApiNames: string[],
  page: number,
  pageSize: number,
): string {
  const obj = safeIdent(objectApiName)
  const fields = fieldApiNames.length === 0 ? ['Id'] : fieldApiNames.map(safeIdent)
  const pageNum = Math.max(1, Math.floor(page))
  const size = Math.max(1, Math.min(200, Math.floor(pageSize))) // SF SOQL LIMIT cap 2000; we keep 200 for preview.
  const offset = (pageNum - 1) * size
  // SOQL disallows ORDER BY on some fields without additional filters; omit for safety.
  return `SELECT ${fields.join(', ')} FROM ${obj} LIMIT ${size} OFFSET ${offset}`
}

/** Build a COUNT() query for total record count. */
export function buildCountQuery(objectApiName: string): string {
  const obj = safeIdent(objectApiName)
  return `SELECT COUNT() FROM ${obj}`
}

/** Narrow view of jsforce's query result we rely on. */
interface QueryResult {
  totalSize: number
  done: boolean
  records: ConnectorRecord[]
}

/**
 * Wrap a jsforce `conn.query()` call and shape the result as PaginatedRecords.
 * The total count is obtained via `totalSize` (accurate for small result sets;
 * for large objects the caller should run a COUNT() query separately).
 *
 * `page` is **1-indexed**: page=1 is the first page. `hasNextPage` is true when
 * the consumed window (records 1..page*pageSize) does not yet cover the total.
 */
export async function executeQuery(
  conn: { query: (soql: string) => Promise<QueryResult> },
  soql: string,
  page: number,
  pageSize: number,
  totalCountHint?: number,
): Promise<PaginatedRecords> {
  const result = await conn.query(soql)
  const totalCount = totalCountHint ?? result.totalSize
  const records = (result.records ?? []).map((r) => stripAttributes(r))
  return {
    records,
    totalCount,
    pageSize,
    currentPage: page,
    hasNextPage: page * pageSize < totalCount,
  }
}

/** Strip jsforce's noisy `attributes` wrapper from a record. */
function stripAttributes(record: ConnectorRecord): ConnectorRecord {
  const { attributes: _attributes, ...rest } = record as Record<string, unknown> & {
    attributes?: unknown
  }
  return rest
}

/**
 * Compute per-field statistics from a set of records.
 * - nullCount: records where the value is null/undefined/empty string.
 * - distinctCount: number of distinct non-null values.
 * - sampleValues: up to 5 distinct non-null values (iteration order = insertion order).
 */
export function calculateFieldStats(
  records: ConnectorRecord[],
  fieldApiName: string,
  sampleLimit = 5,
): FieldStats {
  let nullCount = 0
  const distinct = new Set<unknown>()
  const sample: unknown[] = []

  for (const r of records) {
    const v = (r as Record<string, unknown>)[fieldApiName]
    if (v === null || v === undefined || v === '') {
      nullCount++
      continue
    }
    if (!distinct.has(v)) {
      distinct.add(v)
      if (sample.length < sampleLimit) sample.push(v)
    }
  }

  return {
    fieldApiName,
    nullCount,
    distinctCount: distinct.size,
    sampleValues: sample,
  }
}
