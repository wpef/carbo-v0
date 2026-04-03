// 018-rule-description-engine — Hook for fetching plan descriptions

'use client'

import { useState, useCallback } from 'react'
import type { PlanDescription } from '@/lib/types/rule-description'

interface UsePlanDescriptionState {
  description: PlanDescription | null
  loading: boolean
  error: string
}

interface UsePlanDescriptionReturn extends UsePlanDescriptionState {
  generate: (enhance?: boolean) => Promise<void>
  reset: () => void
}

/**
 * Hook to generate and hold the human-readable PlanDescription.
 *
 * @param planId - The plan ID to generate descriptions for.
 */
export function usePlanDescription(planId: string): UsePlanDescriptionReturn {
  const [state, setState] = useState<UsePlanDescriptionState>({
    description: null,
    loading: false,
    error: '',
  })

  const generate = useCallback(
    async (enhance = false) => {
      setState({ description: null, loading: true, error: '' })

      try {
        const res = await fetch(`/api/plans/${planId}/description`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enhance }),
        })

        const data = await res.json()

        if (!res.ok) {
          setState({ description: null, loading: false, error: data.message ?? 'Failed to generate description.' })
          return
        }

        setState({ description: data as PlanDescription, loading: false, error: '' })
      } catch (err) {
        setState({
          description: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to generate description.',
        })
      }
    },
    [planId],
  )

  const reset = useCallback(() => {
    setState({ description: null, loading: false, error: '' })
  }, [])

  return {
    description: state.description,
    loading: state.loading,
    error: state.error,
    generate,
    reset,
  }
}
