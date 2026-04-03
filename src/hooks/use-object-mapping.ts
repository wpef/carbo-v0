// 011-object-mapping — Hook for object mapping CRUD with link state machine

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LinkState } from '@/lib/types/mapping'
import type {
  ObjectMappingDTO,
  UnmappedSourceObject,
  AvailableDestObject,
  AutoLinkResult,
} from '@/lib/types/mapping'

interface ObjectMappingState {
  mappings: ObjectMappingDTO[]
  unmappedObjects: UnmappedSourceObject[]
  destObjects: AvailableDestObject[]
  loading: boolean
  error: string
  linkState: LinkState
  selectedSourceObjectId: string | null
}

export function useObjectMapping(planId: string) {
  const [state, setState] = useState<ObjectMappingState>({
    mappings: [],
    unmappedObjects: [],
    destObjects: [],
    loading: true,
    error: '',
    linkState: LinkState.IDLE,
    selectedSourceObjectId: null,
  })

  // Track whether auto-link has been attempted on first mount
  const autoLinkedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [mappingsRes, unmappedRes, destRes] = await Promise.all([
        fetch(`/api/plans/${planId}/object-mappings`),
        fetch(`/api/plans/${planId}/object-mappings/unmapped`),
        fetch(`/api/plans/${planId}/object-mappings/dest-objects`),
      ])

      const [mappingsData, unmappedData, destData] = await Promise.all([
        mappingsRes.ok ? mappingsRes.json() : { mappings: [] },
        unmappedRes.ok ? unmappedRes.json() : { objects: [] },
        destRes.ok ? destRes.json() : { objects: [] },
      ])

      setState((prev) => ({
        ...prev,
        mappings: mappingsData.mappings ?? [],
        unmappedObjects: unmappedData.objects ?? [],
        destObjects: destData.objects ?? [],
        loading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load mapping data.',
      }))
    }
  }, [planId])

  // Initial fetch + conditional auto-link on first mount
  useEffect(() => {
    const init = async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const mappingsRes = await fetch(`/api/plans/${planId}/object-mappings`)
        const mappingsData = mappingsRes.ok ? await mappingsRes.json() : { mappings: [] }
        const hasMappings = (mappingsData.mappings ?? []).length > 0

        // Auto-link on first mount if no mappings exist
        if (!hasMappings && !autoLinkedRef.current) {
          autoLinkedRef.current = true
          await fetch(`/api/plans/${planId}/object-mappings/auto-link`, { method: 'POST' })
        }

        await fetchAll()
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to initialize mapping.',
        }))
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  const createLink = useCallback(
    async (
      sourceObjectId: string,
      sourceObjectApiName: string,
      destObjectId: string,
      destObjectApiName: string,
    ): Promise<{ error?: string }> => {
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceObjectId, sourceObjectApiName, destObjectId, destObjectApiName }),
        })
        const data = await res.json()
        if (!res.ok) {
          return { error: data.message ?? 'Failed to create mapping.' }
        }
        // Refresh state after creation
        await fetchAll()
        setState((prev) => ({ ...prev, linkState: LinkState.IDLE, selectedSourceObjectId: null }))
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to create mapping.' }
      }
    },
    [planId, fetchAll],
  )

  const deleteLink = useCallback(
    async (mappingId: string): Promise<{ error?: string }> => {
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings/${mappingId}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const data = await res.json()
          return { error: data.message ?? 'Failed to delete mapping.' }
        }
        // Optimistic removal, then refresh
        setState((prev) => ({
          ...prev,
          mappings: prev.mappings.filter((m) => m.id !== mappingId),
        }))
        await fetchAll()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to delete mapping.' }
      }
    },
    [planId, fetchAll],
  )

  const triggerAutoLink = useCallback(async (): Promise<AutoLinkResult | { error: string }> => {
    try {
      const res = await fetch(`/api/plans/${planId}/object-mappings/auto-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        return { error: data.message ?? 'Auto-link failed.' }
      }
      await fetchAll()
      return data as AutoLinkResult
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Auto-link failed.' }
    }
  }, [planId, fetchAll])

  const selectSourceObject = useCallback((objectId: string | null) => {
    setState((prev) => ({
      ...prev,
      linkState: objectId ? LinkState.SOURCE_SELECTED : LinkState.IDLE,
      selectedSourceObjectId: objectId,
    }))
  }, [])

  return {
    mappings: state.mappings,
    unmappedObjects: state.unmappedObjects,
    destObjects: state.destObjects,
    loading: state.loading,
    error: state.error,
    linkState: state.linkState,
    selectedSourceObjectId: state.selectedSourceObjectId,
    createLink,
    deleteLink,
    triggerAutoLink,
    selectSourceObject,
    refresh: fetchAll,
  }
}
