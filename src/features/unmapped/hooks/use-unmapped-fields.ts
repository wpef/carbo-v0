// 016-unmapped-fields-detection — Hook for unmapped fields report (per mapping or plan-level)
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UnmappedFieldsReport } from '../lib/compute-unmapped'
import type { FieldExclusionDTO } from '../services/unmapped-service'

export type { UnmappedFieldsReport }

interface UseUnmappedFieldsState {
  report: UnmappedFieldsReport | null
  exclusions: FieldExclusionDTO[]
  loading: boolean
  error: string
}

/**
 * Fetches the unmapped-fields report for a single object mapping.
 * Refetches whenever `version` changes (pass an incrementing counter from the parent).
 */
export function useUnmappedFields(
  planId: string,
  objectMappingId: string,
  version = 0,
) {
  const [state, setState] = useState<UseUnmappedFieldsState>({
    report: null,
    exclusions: [],
    loading: true,
    error: '',
  })

  const fetch_ = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [reportRes, exclusionsRes] = await Promise.all([
        fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/unmapped`),
        fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/exclusions`),
      ])
      const [reportData, exclusionsData] = await Promise.all([
        reportRes.ok ? reportRes.json() : null,
        exclusionsRes.ok ? exclusionsRes.json() : { exclusions: [] },
      ])
      setState({
        report: reportData as UnmappedFieldsReport | null,
        exclusions: (exclusionsData.exclusions ?? []) as FieldExclusionDTO[],
        loading: false,
        error: reportData ? '' : 'Failed to load unmapped fields report.',
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load.',
      }))
    }
  }, [planId, objectMappingId])

  useEffect(() => { fetch_() }, [fetch_, version])

  const excludeField = useCallback(
    async (sourceFieldName: string, reason?: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${objectMappingId}/exclusions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceFieldName, reason }),
          },
        )
        if (!res.ok) {
          const data = await res.json()
          return { error: data.message ?? 'Failed to exclude field.' }
        }
        await fetch_()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to exclude field.' }
      }
    },
    [planId, objectMappingId, fetch_],
  )

  const includeField = useCallback(
    async (exclusionId: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${objectMappingId}/exclusions?exclusionId=${exclusionId}`,
          { method: 'DELETE' },
        )
        if (!res.ok && res.status !== 204) {
          const data = await res.json()
          return { error: data.message ?? 'Failed to re-include field.' }
        }
        await fetch_()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to re-include field.' }
      }
    },
    [planId, objectMappingId, fetch_],
  )

  return {
    report: state.report,
    exclusions: state.exclusions,
    loading: state.loading,
    error: state.error,
    excludeField,
    includeField,
    refresh: fetch_,
  }
}
