// 005-source-field-retrieval — Hook for field retrieval API calls
// 008-destination-field-retrieval — Extended to support role-aware API paths

'use client'

import { useState, useCallback } from 'react'
import type { FieldRetrievalResult, FieldsByObjectResult, ObjectFieldResult } from '@/lib/types/field'

interface FieldsState {
  data: FieldsByObjectResult | null
  loading: boolean
  retrieving: boolean
  lastResult: FieldRetrievalResult | null
  error: string
}

function getApiBasePath(planId: string, role: 'source' | 'destination'): string {
  if (role === 'destination') {
    return `/api/plans/${planId}/destination-fields`
  }
  return `/api/plans/${planId}/source/fields`
}

export function useFields(planId: string, role: 'source' | 'destination' = 'source') {
  const [state, setState] = useState<FieldsState>({
    data: null,
    loading: false,
    retrieving: false,
    lastResult: null,
    error: '',
  })

  const apiBasePath = getApiBasePath(planId, role)

  /**
   * Trigger field retrieval via POST (fetches from adapter and persists).
   */
  const retrieveFields = useCallback(async (): Promise<FieldRetrievalResult | null> => {
    setState((prev) => ({ ...prev, retrieving: true, error: '' }))
    try {
      const res = await fetch(apiBasePath, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? 'Failed to retrieve fields.')
      }
      const result = data as FieldRetrievalResult
      setState((prev) => ({ ...prev, retrieving: false, lastResult: result }))
      return result
    } catch (err) {
      setState((prev) => ({
        ...prev,
        retrieving: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
      return null
    }
  }, [apiBasePath])

  /**
   * Fetch persisted fields grouped by object (GET).
   */
  const fetchFields = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(apiBasePath)
      if (res.status === 404) {
        setState((prev) => ({ ...prev, loading: false, data: null }))
        return
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? 'Failed to load fields.')
      }
      setState((prev) => ({ ...prev, loading: false, data: data as FieldsByObjectResult }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [apiBasePath])

  /**
   * Fetch fields for a single object (GET).
   * Only supported for source role (destination uses the base path with ?object= filter).
   */
  const fetchFieldsForObject = useCallback(
    async (objectId: string): Promise<ObjectFieldResult[] | null> => {
      try {
        const url =
          role === 'source'
            ? `/api/plans/${planId}/source/fields/${objectId}`
            : `${apiBasePath}?object=${encodeURIComponent(objectId)}`
        const res = await fetch(url)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message ?? 'Failed to load fields for object.')
        }
        return data.fields as ObjectFieldResult[]
      } catch (err) {
        console.error('[useFields] fetchFieldsForObject error:', err)
        return null
      }
    },
    [planId, role, apiBasePath],
  )

  /**
   * Retrieve and then reload — convenience for the page button.
   */
  const retrieveAndRefresh = useCallback(async (): Promise<FieldRetrievalResult | null> => {
    const result = await retrieveFields()
    if (result) {
      await fetchFields()
    }
    return result
  }, [retrieveFields, fetchFields])

  return {
    data: state.data,
    loading: state.loading,
    retrieving: state.retrieving,
    lastResult: state.lastResult,
    error: state.error,
    retrieveFields,
    fetchFields,
    fetchFieldsForObject,
    retrieveAndRefresh,
  }
}
