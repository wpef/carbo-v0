// 012-field-mapping — Hook for field mapping CRUD with link-state machine (v4)
// Cluster 16: real-time search + auto-match + delete + create.
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { FieldMappingDTO, CreateFieldMappingInput, UnmappedSourceField, AvailableDestField } from '../types'

export type { FieldMappingDTO, UnmappedSourceField, AvailableDestField }

export type LinkState = 'IDLE' | 'SOURCE_SELECTED'

interface FieldMappingState {
  fieldMappings: FieldMappingDTO[]
  unmappedSourceFields: UnmappedSourceField[]
  availableDestFields: AvailableDestField[]
  loading: boolean
  error: string
  linkState: LinkState
  selectedSourceFieldName: string | null
  searchQuery: string
}

export function useFieldMapping(planId: string, objectMappingId: string) {
  const [state, setState] = useState<FieldMappingState>({
    fieldMappings: [],
    unmappedSourceFields: [],
    availableDestFields: [],
    loading: true,
    error: '',
    linkState: 'IDLE',
    selectedSourceFieldName: null,
    searchQuery: '',
  })

  const autoMatchedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings`)
      const data = res.ok ? await res.json() : {}
      setState((prev) => ({
        ...prev,
        fieldMappings: data.fieldMappings ?? [],
        unmappedSourceFields: data.unmappedSourceFields ?? [],
        availableDestFields: data.availableDestFields ?? [],
        loading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load field mapping data.',
      }))
    }
  }, [planId, objectMappingId])

  useEffect(() => {
    const init = async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings`)
        const data = res.ok ? await res.json() : { fieldMappings: [] }
        const hasMappings = (data.fieldMappings ?? []).length > 0

        // Auto-match on first mount if no mappings exist yet
        if (!hasMappings && !autoMatchedRef.current) {
          autoMatchedRef.current = true
          await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoMatch: true }),
          })
        }

        await fetchAll()
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to initialize field mapping.',
        }))
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, objectMappingId])

  const createLink = useCallback(
    async (input: CreateFieldMappingInput): Promise<{ error?: string }> => {
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 409) return { error: `Doublon : le champ source "${input.sourceFieldName}" est déjà mappé.` }
          return { error: data.message ?? 'Failed to create field mapping.' }
        }
        await fetchAll()
        setState((prev) => ({ ...prev, linkState: 'IDLE', selectedSourceFieldName: null }))
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to create field mapping.' }
      }
    },
    [planId, objectMappingId, fetchAll],
  )

  const deleteLink = useCallback(
    async (fieldMappingId: string): Promise<{ error?: string }> => {
      // Optimistic removal
      setState((prev) => ({
        ...prev,
        fieldMappings: prev.fieldMappings.filter((m) => m.id !== fieldMappingId),
      }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings?fieldMappingId=${fieldMappingId}`,
          { method: 'DELETE' },
        )
        if (!res.ok && res.status !== 204) {
          const data = await res.json()
          await fetchAll() // revert optimistic
          return { error: data.message ?? 'Failed to delete field mapping.' }
        }
        await fetchAll()
        return {}
      } catch (err) {
        await fetchAll()
        return { error: err instanceof Error ? err.message : 'Failed to delete field mapping.' }
      }
    },
    [planId, objectMappingId, fetchAll],
  )

  const triggerAutoMatch = useCallback(async (): Promise<{ created: number; skipped: number } | { error: string }> => {
    try {
      const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMatch: true }),
      })
      const data = await res.json()
      if (!res.ok) return { error: data.message ?? 'Auto-match failed.' }
      await fetchAll()
      return data as { created: number; skipped: number }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Auto-match failed.' }
    }
  }, [planId, objectMappingId, fetchAll])

  const selectSourceField = useCallback((fieldName: string | null) => {
    setState((prev) => ({
      ...prev,
      linkState: fieldName ? 'SOURCE_SELECTED' : 'IDLE',
      selectedSourceFieldName: fieldName,
    }))
  }, [])

  const setSearch = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Derived: filtered views based on search query
  const lowerSearch = state.searchQuery.toLowerCase()
  const filteredMappings = state.searchQuery
    ? state.fieldMappings.filter(
        (m) =>
          m.sourceFieldName.toLowerCase().includes(lowerSearch) ||
          m.sourceFieldLabel.toLowerCase().includes(lowerSearch) ||
          m.destinationFieldName.toLowerCase().includes(lowerSearch) ||
          m.destFieldLabel.toLowerCase().includes(lowerSearch),
      )
    : state.fieldMappings

  const filteredUnmapped = state.searchQuery
    ? state.unmappedSourceFields.filter(
        (f) =>
          f.apiName.toLowerCase().includes(lowerSearch) ||
          f.label.toLowerCase().includes(lowerSearch),
      )
    : state.unmappedSourceFields

  return {
    fieldMappings: state.fieldMappings,
    filteredMappings,
    filteredUnmapped,
    unmappedSourceFields: state.unmappedSourceFields,
    availableDestFields: state.availableDestFields,
    loading: state.loading,
    error: state.error,
    linkState: state.linkState,
    selectedSourceFieldName: state.selectedSourceFieldName,
    searchQuery: state.searchQuery,
    createLink,
    deleteLink,
    triggerAutoMatch,
    selectSourceField,
    setSearch,
    refresh: fetchAll,
  }
}
