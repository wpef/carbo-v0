// 017-mapping-integrity-check — Client hook (v4)
// Fetches the integrity check result for a plan and provides repair + resolve actions.
// GET  /api/plans/[planId]/integrity  -> IntegrityCheckResult
// POST /api/plans/[planId]/integrity  -> RepairResult
// PATCH /api/plans/[planId]/integrity -> { issue, planStatus }

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IntegrityCheckResult, IntegrityIssueDTO, RepairResult } from '../types'

export interface UseIntegrityState {
  result: IntegrityCheckResult | null
  loading: boolean
  repairing: boolean
  resolving: string | null // issueId being resolved, or null
  error: string | null
}

export function useIntegrity(planId: string) {
  const [state, setState] = useState<UseIntegrityState>({
    result: null,
    loading: true,
    repairing: false,
    resolving: null,
    error: null,
  })

  const runCheck = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(`/api/plans/${planId}/integrity`)
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setState((prev) => ({ ...prev, loading: false, error: data.message ?? 'Integrity check failed' }))
        return
      }
      const result = (await res.json()) as IntegrityCheckResult
      setState((prev) => ({ ...prev, result, loading: false, error: null }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Integrity check failed',
      }))
    }
  }, [planId])

  const repair = useCallback(async (): Promise<RepairResult | null> => {
    setState((prev) => ({ ...prev, repairing: true, error: null }))
    try {
      const res = await fetch(`/api/plans/${planId}/integrity`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setState((prev) => ({ ...prev, repairing: false, error: (data as { message?: string }).message ?? 'Repair failed' }))
        return null
      }
      // Re-fetch after repair to get updated result
      await runCheck()
      setState((prev) => ({ ...prev, repairing: false }))
      return data as RepairResult
    } catch (err) {
      setState((prev) => ({
        ...prev,
        repairing: false,
        error: err instanceof Error ? err.message : 'Repair failed',
      }))
      return null
    }
  }, [planId, runCheck])

  const resolveIssue = useCallback(
    async (issueId: string): Promise<{ issue: IntegrityIssueDTO; planStatus: string } | null> => {
      setState((prev) => ({ ...prev, resolving: issueId, error: null }))
      try {
        const res = await fetch(`/api/plans/${planId}/integrity`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setState((prev) => ({ ...prev, resolving: null, error: (data as { message?: string }).message ?? 'Resolve failed' }))
          return null
        }
        // Refresh the result list
        await runCheck()
        setState((prev) => ({ ...prev, resolving: null }))
        return data as { issue: IntegrityIssueDTO; planStatus: string }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          resolving: null,
          error: err instanceof Error ? err.message : 'Resolve failed',
        }))
        return null
      }
    },
    [planId, runCheck],
  )

  // Auto-run the check on mount
  useEffect(() => {
    runCheck()
  }, [runCheck])

  return {
    result: state.result,
    loading: state.loading,
    repairing: state.repairing,
    resolving: state.resolving,
    error: state.error,
    runCheck,
    repair,
    resolveIssue,
  }
}
