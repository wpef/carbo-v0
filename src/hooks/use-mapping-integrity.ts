// 017-mapping-integrity-check — Hook to check and repair mapping integrity for a plan

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IntegrityReport, RepairResult } from '@/lib/types/integrity'

interface MappingIntegrityState {
  report: IntegrityReport | null
  loading: boolean
  repairing: boolean
  error: string
}

export function useMappingIntegrity(planId: string) {
  const [state, setState] = useState<MappingIntegrityState>({
    report: null,
    loading: true,
    repairing: false,
    error: '',
  })

  const fetchReport = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/plans/${planId}/integrity`)
      if (!res.ok) {
        const data = await res.json()
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.message ?? 'Failed to load integrity report.',
        }))
        return
      }
      const report: IntegrityReport = await res.json()
      setState((prev) => ({ ...prev, report, loading: false, error: '' }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load integrity report.',
      }))
    }
  }, [planId])

  const repair = useCallback(async (): Promise<RepairResult | { error: string }> => {
    setState((prev) => ({ ...prev, repairing: true, error: '' }))
    try {
      const res = await fetch(`/api/plans/${planId}/integrity`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          repairing: false,
          error: data.message ?? 'Repair failed.',
        }))
        return { error: data.message ?? 'Repair failed.' }
      }
      // Re-fetch the report after repair
      await fetchReport()
      setState((prev) => ({ ...prev, repairing: false }))
      return data as RepairResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Repair failed.'
      setState((prev) => ({ ...prev, repairing: false, error: message }))
      return { error: message }
    }
  }, [planId, fetchReport])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  return {
    report: state.report,
    loading: state.loading,
    repairing: state.repairing,
    error: state.error,
    refresh: fetchReport,
    repair,
  }
}
