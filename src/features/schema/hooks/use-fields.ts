// 005-source-field-retrieval / 008-destination-field-retrieval
// Hook for field retrieval: trigger POST (retrieve), GET (load persisted), GET by objectId (lazy).

'use client'

import { useState, useCallback } from 'react'

export interface ObjectFieldResult {
  id: string
  objectId: string
  snapshotId: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  isAccessible: boolean
  referenceTo: string | null
  relationshipType: string | null
  picklistValues: string | null
}

export interface FieldRetrievalItemResult {
  objectApiName: string
  fieldCount: number
  error?: string
}

export interface FieldsState {
  /** Grouped: objectApiName -> ObjectFieldResult[] */
  data: Record<string, ObjectFieldResult[]> | null
  loading: boolean
  retrieving: boolean
  lastResults: FieldRetrievalItemResult[] | null
  error: string
}

function apiPath(planId: string, role: 'source' | 'destination'): string {
  return role === 'destination'
    ? `/api/plans/${planId}/destination/fields`
    : `/api/plans/${planId}/source/fields`
}

export function useFields(planId: string, role: 'source' | 'destination' = 'source') {
  const [state, setState] = useState<FieldsState>({
    data: null,
    loading: false,
    retrieving: false,
    lastResults: null,
    error: '',
  })

  const basePath = apiPath(planId, role)

  /** Load persisted fields grouped by object (GET). */
  const fetchFields = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(basePath)
      if (res.status === 404) {
        setState((prev) => ({ ...prev, loading: false, data: null }))
        return
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? 'Failed to load fields.')
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        data: data as Record<string, ObjectFieldResult[]>,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [basePath])

  /** Trigger field retrieval (POST) and return per-object results. */
  const retrieveFields = useCallback(async (): Promise<FieldRetrievalItemResult[] | null> => {
    setState((prev) => ({ ...prev, retrieving: true, error: '' }))
    try {
      const res = await fetch(basePath, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Failed to retrieve fields.')
      }
      const results = (data.results ?? []) as FieldRetrievalItemResult[]
      setState((prev) => ({ ...prev, retrieving: false, lastResults: results }))
      return results
    } catch (err) {
      setState((prev) => ({
        ...prev,
        retrieving: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
      return null
    }
  }, [basePath])

  /** Retrieve then reload — convenience for the page button. */
  const retrieveAndRefresh = useCallback(async (): Promise<FieldRetrievalItemResult[] | null> => {
    const results = await retrieveFields()
    if (results) await fetchFields()
    return results
  }, [retrieveFields, fetchFields])

  /** Lazy load fields for a single object by objectId (source only). */
  const fetchFieldsForObject = useCallback(
    async (objectId: string): Promise<ObjectFieldResult[] | null> => {
      try {
        const url =
          role === 'source'
            ? `/api/plans/${planId}/source/fields/${objectId}`
            : `${basePath}?object=${encodeURIComponent(objectId)}`
        const res = await fetch(url)
        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? 'Failed to load fields.')
        return (data.fields ?? []) as ObjectFieldResult[]
      } catch (err) {
        console.error('[useFields] fetchFieldsForObject error:', err)
        return null
      }
    },
    [planId, role, basePath],
  )

  // Derived summary
  const groupedData = state.data
  const summary = groupedData
    ? (() => {
        const objectCount = Object.keys(groupedData).length
        const allFields = Object.values(groupedData).flat()
        const totalFields = allFields.length
        const inaccessibleFields = allFields.filter((f) => !f.isAccessible).length
        return { objectCount, totalFields, inaccessibleFields }
      })()
    : null

  const objects = groupedData
    ? Object.entries(groupedData).map(([objectApiName, fields]) => ({
        objectApiName,
        objectLabel: objectApiName, // label not available in grouped response without extra fetch
        fields,
        fieldCount: fields.length,
      }))
    : []

  return {
    data: groupedData ? { objects, summary: summary! } : null,
    rawData: groupedData,
    loading: state.loading,
    retrieving: state.retrieving,
    lastResults: state.lastResults,
    error: state.error,
    fetchFields,
    retrieveFields,
    retrieveAndRefresh,
    fetchFieldsForObject,
  }
}
