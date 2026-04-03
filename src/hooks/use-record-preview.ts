// 009-record-preview — Hook for paginated record preview
// 010-field-stats — Extended with fieldStats computed from fetched records

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FieldStats, PaginatedRecords } from '@/lib/connectors/types'
import { computeFieldStats } from '@/utils/compute-field-stats'

interface RecordPreviewState {
  data: PaginatedRecords | null
  loading: boolean
  error: string
  /** Per-field stats computed from the current page of records. Null when no records loaded. */
  fieldStats: FieldStats[] | null
}

interface UseRecordPreviewReturn extends RecordPreviewState {
  currentPage: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  retry: () => void
}

export function useRecordPreview(
  planId: string,
  role: 'source' | 'destination',
  objectApiName: string,
): UseRecordPreviewReturn {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(25)
  const [state, setState] = useState<RecordPreviewState>({
    data: null,
    loading: true,
    error: '',
    fieldStats: null,
  })

  // Use a ref to track the current fetch sequence and avoid stale updates
  const fetchId = useRef(0)

  const fetchRecords = useCallback(
    async (currentPage: number, currentPageSize: number) => {
      const id = ++fetchId.current
      setState((prev) => ({ ...prev, loading: true, error: '' }))

      try {
        const url = `/api/plans/${planId}/records/${encodeURIComponent(objectApiName)}?role=${role}&page=${currentPage}&pageSize=${currentPageSize}`
        const res = await fetch(url)
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.message ?? 'Failed to load records.')
        }

        // Discard if a newer fetch was started in the meantime
        if (id !== fetchId.current) return

        const paginatedRecords = json as PaginatedRecords
        const fieldStats = paginatedRecords.records.length > 0
          ? computeFieldStats(paginatedRecords.records)
          : null

        setState({ data: paginatedRecords, loading: false, error: '', fieldStats })
      } catch (err) {
        if (id !== fetchId.current) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          fieldStats: null,
        }))
      }
    },
    [planId, role, objectApiName],
  )

  // Fetch on mount and whenever page/pageSize changes
  useEffect(() => {
    fetchRecords(page, pageSize)
  }, [fetchRecords, page, pageSize])

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
  }, [])

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize)
    setPageState(1) // reset to page 1 on page size change
  }, [])

  const retry = useCallback(() => {
    fetchRecords(page, pageSize)
  }, [fetchRecords, page, pageSize])

  return {
    ...state,
    currentPage: page,
    pageSize,
    setPage,
    setPageSize,
    retry,
  }
}
