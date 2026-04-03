// 012-field-mapping — Hook for field mapping CRUD with link state machine

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FieldLinkState } from '@/lib/types/field-mapping'
import type {
  FieldMappingDTO,
  UnmappedSourceField,
  AvailableDestField,
  FieldAutoMatchResult,
  CreateFieldMappingInput,
} from '@/lib/types/field-mapping'

interface FieldMappingState {
  fieldMappings: FieldMappingDTO[]
  unmappedSourceFields: UnmappedSourceField[]
  availableDestFields: AvailableDestField[]
  loading: boolean
  error: string
  linkState: FieldLinkState
  selectedSourceFieldId: string | null
}

export function useFieldMapping(planId: string, objectMappingId: string) {
  const [state, setState] = useState<FieldMappingState>({
    fieldMappings: [],
    unmappedSourceFields: [],
    availableDestFields: [],
    loading: true,
    error: '',
    linkState: FieldLinkState.IDLE,
    selectedSourceFieldId: null,
  })

  // Track whether auto-match has been attempted on first mount
  const autoMatchedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [fieldsRes, unmappedRes] = await Promise.all([
        fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields`),
        fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields/unmapped`),
      ])

      const [fieldsData, unmappedData] = await Promise.all([
        fieldsRes.ok ? fieldsRes.json() : { fieldMappings: [], availableDestFields: [] },
        unmappedRes.ok ? unmappedRes.json() : { fields: [] },
      ])

      setState((prev) => ({
        ...prev,
        fieldMappings: fieldsData.fieldMappings ?? [],
        availableDestFields: fieldsData.availableDestFields ?? [],
        unmappedSourceFields: unmappedData.fields ?? [],
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

  // Initial fetch + conditional auto-match on first mount
  useEffect(() => {
    const init = async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const fieldsRes = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields`)
        const fieldsData = fieldsRes.ok ? await fieldsRes.json() : { fieldMappings: [] }
        const hasMappings = (fieldsData.fieldMappings ?? []).length > 0

        // Auto-match on first mount if no mappings exist
        if (!hasMappings && !autoMatchedRef.current) {
          autoMatchedRef.current = true
          await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields/auto-match`, {
            method: 'POST',
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
        const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok) {
          return { error: data.message ?? 'Failed to create field mapping.' }
        }
        await fetchAll()
        setState((prev) => ({ ...prev, linkState: FieldLinkState.IDLE, selectedSourceFieldId: null }))
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to create field mapping.' }
      }
    },
    [planId, objectMappingId, fetchAll],
  )

  const deleteLink = useCallback(
    async (fieldMappingId: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${objectMappingId}/fields/${fieldMappingId}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          const data = await res.json()
          return { error: data.message ?? 'Failed to delete field mapping.' }
        }
        // Optimistic removal, then refresh
        setState((prev) => ({
          ...prev,
          fieldMappings: prev.fieldMappings.filter((m) => m.id !== fieldMappingId),
        }))
        await fetchAll()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to delete field mapping.' }
      }
    },
    [planId, objectMappingId, fetchAll],
  )

  const triggerAutoMatch = useCallback(async (): Promise<FieldAutoMatchResult | { error: string }> => {
    try {
      const res = await fetch(`/api/plans/${planId}/object-mappings/${objectMappingId}/fields/auto-match`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        return { error: data.message ?? 'Auto-match failed.' }
      }
      await fetchAll()
      return data as FieldAutoMatchResult
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Auto-match failed.' }
    }
  }, [planId, objectMappingId, fetchAll])

  const selectSourceField = useCallback((fieldId: string | null) => {
    setState((prev) => ({
      ...prev,
      linkState: fieldId ? FieldLinkState.SOURCE_SELECTED : FieldLinkState.IDLE,
      selectedSourceFieldId: fieldId,
    }))
  }, [])

  return {
    fieldMappings: state.fieldMappings,
    unmappedSourceFields: state.unmappedSourceFields,
    availableDestFields: state.availableDestFields,
    loading: state.loading,
    error: state.error,
    linkState: state.linkState,
    selectedSourceFieldId: state.selectedSourceFieldId,
    createLink,
    deleteLink,
    triggerAutoMatch,
    selectSourceField,
    refresh: fetchAll,
  }
}
