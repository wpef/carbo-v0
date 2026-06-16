// 010-field-stats — Pure client-side utility: compute per-field stats from fetched records
// FR-002: fill rate, distinct, sample values — computed from the current page (no server call).

import type { ConnectorRecord, FieldStats } from '@/lib/types/connector'

const BINARY_PLACEHOLDER = '[binary data]'
const MAX_DISTINCT_TRACK = 1000
const MAX_SAMPLE_VALUES = 5

/**
 * Compute per-field stats from an array of records in a single pass.
 *
 * For each field found across all records:
 *  - nullCount: number of records where the field is null, undefined, or absent
 *  - distinctCount: number of unique non-null values (capped at 1000 tracked)
 *  - sampleValues: up to 5 unique non-null values encountered first
 *
 * Binary fields (detected by "[binary data]" placeholder) are returned with
 * nullCount = -1 as a sentinel so the UI can render "N/A".
 *
 * Handles sparse records: fields absent from some records count as null.
 */
export function computeFieldStats(records: ConnectorRecord[]): FieldStats[] {
  if (records.length === 0) return []

  // Collect all field names across all records (preserve insertion order)
  const fieldSet = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      fieldSet.add(key)
    }
  }

  const results: FieldStats[] = []

  for (const fieldApiName of fieldSet) {
    let nullCount = 0
    let isBinary = false
    const distinctValues = new Set<string>()
    const sampleValues: unknown[] = []

    for (const record of records) {
      const value = record[fieldApiName]

      // Absent field or explicit null → count as null
      if (value === null || value === undefined || !(fieldApiName in record)) {
        nullCount++
        continue
      }

      // Detect binary placeholder
      if (value === BINARY_PLACEHOLDER) {
        isBinary = true
        continue
      }

      const str = String(value)
      if (distinctValues.size < MAX_DISTINCT_TRACK) {
        distinctValues.add(str)
      }
      if (sampleValues.length < MAX_SAMPLE_VALUES && !sampleValues.some((s) => String(s) === str)) {
        sampleValues.push(value)
      }
    }

    if (isBinary) {
      results.push({ fieldApiName, nullCount: -1, distinctCount: -1, sampleValues: [] })
    } else {
      results.push({ fieldApiName, nullCount, distinctCount: distinctValues.size, sampleValues })
    }
  }

  return results
}
