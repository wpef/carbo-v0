// HubSpot — Search API (paginated) + field stats
// Ref: specs/adapters/hubspot/ (T008)

import { HS_API_BASE } from './hubspot-constants'
import type { ConnectorRecord, FieldStats, PaginatedRecords } from '@/lib/connectors/types'

interface HSSearchResponse {
  total: number
  results: Array<{
    id: string
    properties: Record<string, unknown>
    createdAt?: string
    updatedAt?: string
    archived?: boolean
  }>
  paging?: {
    next?: { after?: string; link?: string }
  }
}

/**
 * Cursor store keyed by `${planId}:${objectType}:${page}` so we can paginate
 * HubSpot's cursor-based Search API via a zero-based page index.
 *
 * Held on `globalThis` so it survives Next.js hot-reload.
 */
declare global {

  var __hsCursorStore: Map<string, string> | undefined
}
function cursorStore(): Map<string, string> {
  if (!globalThis.__hsCursorStore) globalThis.__hsCursorStore = new Map()
  return globalThis.__hsCursorStore
}
function cursorKey(scope: string, objectType: string, page: number): string {
  return `${scope}::${objectType}::${page}`
}

/**
 * Retrieve a page of records for a HubSpot object.
 * HubSpot's Search API uses cursors, not offsets. We adapt by storing the cursor
 * for the next page under a key identifying "scope" (e.g. connectionId), objectType and page.
 *
 * `page` is **1-indexed** (page=1 → first page, no cursor walk required). The
 * convention matches the demo adapters, the SF adapter (since 2026-05-12), and
 * the API route (page >= 1).
 */
export async function searchRecords(
  accessToken: string,
  scope: string,
  objectType: string,
  properties: string[],
  page: number,
  pageSize: number,
): Promise<PaginatedRecords> {
  const limit = Math.max(1, Math.min(100, Math.floor(pageSize))) // HubSpot Search API max is 100.
  const pageNum = Math.max(1, Math.floor(page))

  // Walk forward from page 1 using stored cursors if needed.
  // page=1 → no walk (after=undefined → first page).
  // page=N → use cached cursor for page N, else re-walk (N-1) times from page 1.
  const store = cursorStore()
  let after: string | undefined
  if (pageNum > 1) {
    after = store.get(cursorKey(scope, objectType, pageNum))
    if (!after) {
      // Re-walk from page 1 to rebuild cursors (rare; happens on cold cache).
      let cursor: string | undefined
      for (let i = 1; i < pageNum; i++) {
        const r = await callSearch(accessToken, objectType, properties, limit, cursor)
        cursor = r.paging?.next?.after
        if (cursor) store.set(cursorKey(scope, objectType, i + 1), cursor)
        if (!cursor) break
      }
      after = store.get(cursorKey(scope, objectType, pageNum))
    }
  }

  const data = await callSearch(accessToken, objectType, properties, limit, after)

  // Cache the cursor for the *next* page.
  const nextCursor = data.paging?.next?.after
  if (nextCursor) store.set(cursorKey(scope, objectType, pageNum + 1), nextCursor)

  return {
    records: mapToConnectorRecords(data.results),
    totalCount: data.total,
    pageSize: limit,
    currentPage: pageNum,
    hasNextPage: Boolean(nextCursor),
  }
}

async function callSearch(
  accessToken: string,
  objectType: string,
  properties: string[],
  limit: number,
  after: string | undefined,
): Promise<HSSearchResponse> {
  const body: Record<string, unknown> = {
    properties: properties.length > 0 ? properties : undefined,
    limit,
  }
  if (after) body.after = after

  const res = await fetch(`${HS_API_BASE}/crm/v3/objects/${encodeURIComponent(objectType)}/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`HubSpot search failed (${res.status}) on ${objectType}: ${res.statusText}`)
  }
  return (await res.json()) as HSSearchResponse
}

/** Flatten HubSpot's { id, properties: { ... } } shape into a single object. */
export function mapToConnectorRecords(
  results: HSSearchResponse['results'],
): ConnectorRecord[] {
  return results.map((r) => ({ id: r.id, ...r.properties }))
}

/** Same algorithm as the SF variant; local copy so the modules stay independent. */
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
  return { fieldApiName, nullCount, distinctCount: distinct.size, sampleValues: sample }
}

/**
 * Count records for an object via a POST /search with limit=1.
 * HubSpot returns the total in the same call.
 */
export async function countRecords(accessToken: string, objectType: string): Promise<number> {
  const r = await callSearch(accessToken, objectType, [], 1, undefined)
  return r.total
}
