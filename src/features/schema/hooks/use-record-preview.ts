// 009-record-preview — Hook for paginated record preview with race-guard
// 010-field-stats  — fieldStats computed CLIENT-SIDE from fetched records

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FieldStats, PaginatedRecords } from '@/lib/types/connector'
import { computeFieldStats } from '@/lib/utils/compute-field-stats'

interface RecordPreviewState {
  data: PaginatedRecords | null
  loading: boolean
  error: string
  fieldStats: FieldStats[] | null
}

interface UseRecordPreviewReturn extends RecordPreviewState {
  currentPage: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  retry: () => void
}

/** side param matches SnapshotSide enum: 'source' | 'destination' (lowercased for URL) */
export function useRecordPreview(
  planId: string,
  side: 'source' | 'destination',
  objectApiName: string,
  defaultPageSize = 50,
): UseRecordPreviewReturn {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize)
  const [state, setState] = useState<RecordPreviewState>({
    data: null,
    loading: true,
    error: '',
    fieldStats: null,
  })

  // Race-guard: discard stale fetch results
  const fetchIdRef = useRef(0)

  const fetchRecords = useCallback(
    async (currentPage: number, currentPageSize: number) => {
      const id = ++fetchIdRef.current
      setState((prev) => ({ ...prev, loading: true, error: '' }))

      try {
        const url = `/api/plans/${planId}/${side}/records/${encodeURIComponent(objectApiName)}?page=${currentPage}&pageSize=${currentPageSize}`
        const res = await fetch(url)
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error ?? json.message ?? 'Failed to load records.')
        }

        // Drop if a newer fetch was started
        if (id !== fetchIdRef.current) return

        const paginatedRecords = json as PaginatedRecords
        const fieldStats =
          paginatedRecords.records.length > 0 ? computeFieldStats(paginatedRecords.records) : null

        setState({ data: paginatedRecords, loading: false, error: '', fieldStats })
      } catch (err) {
        if (id !== fetchIdRef.current) return
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          fieldStats: null,
        }))
      }
    },
    [planId, side, objectApiName],
  )

  useEffect(() => {
    fetchRecords(page, pageSize)
  }, [fetchRecords, page, pageSize])

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
  }, [])

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize)
    setPageState(1) // reset to first page on size change
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
