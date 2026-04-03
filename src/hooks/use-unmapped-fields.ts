// 016-unmapped-fields-detection — Hook to fetch unmapped fields report for a plan

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UnmappedFieldsReport } from '@/lib/types/unmapped-fields'

interface UnmappedFieldsState {
  report: UnmappedFieldsReport | null
  loading: boolean
  error: string
}

export function useUnmappedFields(planId: string) {
  const [state, setState] = useState<UnmappedFieldsState>({
    report: null,
    loading: true,
    error: '',
  })

  const fetchReport = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/plans/${planId}/unmapped-fields`)
      if (!res.ok) {
        const data = await res.json()
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.message ?? 'Failed to load unmapped fields report.',
        }))
        return
      }
      const report: UnmappedFieldsReport = await res.json()
      setState({ report, loading: false, error: '' })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load unmapped fields report.',
      }))
    }
  }, [planId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return {
    report: state.report,
    loading: state.loading,
    error: state.error,
    refresh: fetchReport,
  }
}
