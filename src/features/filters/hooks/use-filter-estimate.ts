// 015-migration-filters — Hook for estimated record count

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FilterEstimate } from '../types'

/**
 * Fetches the estimated record count for an object mapping's active filters.
 * Auto-refreshes when `version` changes (increment after add/remove).
 * Debounces requests by 1s to avoid hammering the source connector.
 */
export function useFilterEstimate(planId: string, mappingId: string, version: number) {
  const [estimate, setEstimate] = useState<FilterEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEstimate = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/plans/${planId}/object-mappings/${mappingId}/filters/estimate`,
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Échec de l'estimation.")
        setIsLoading(false)
        return
      }
      const data: FilterEstimate = await res.json()
      setEstimate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'estimation.")
    } finally {
      setIsLoading(false)
    }
  }, [planId, mappingId])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(fetchEstimate, 1000)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [fetchEstimate, version])

  return { estimate, isLoading, error, refresh: fetchEstimate }
}
