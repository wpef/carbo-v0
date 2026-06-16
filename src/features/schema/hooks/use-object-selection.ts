// 004-source-object-selection — Hook for object selection state
// Optimistic toggle with revert. includeSystem toggle. Summary (total/selected/system/custom).

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ObjectWithSelection {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  isSelected: boolean
  category: 'custom' | 'business' | 'system'
}

export interface SelectionSummary {
  total: number
  selected: number
  system: number
  custom: number
}

interface ObjectSelectionState {
  objects: ObjectWithSelection[]
  summary: SelectionSummary
  snapshotId: string | null
  connectionId: string | null
  loading: boolean
  saving: boolean
  error: string
  includeSystem: boolean
}

const EMPTY_SUMMARY: SelectionSummary = { total: 0, selected: 0, system: 0, custom: 0 }

export function useObjectSelection(planId: string) {
  const [state, setState] = useState<ObjectSelectionState>({
    objects: [],
    summary: EMPTY_SUMMARY,
    snapshotId: null,
    connectionId: null,
    loading: true,
    saving: false,
    error: '',
    includeSystem: false,
  })

  const fetchObjects = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/plans/${planId}/source/objects`)
      if (res.status === 404) {
        setState((prev) => ({ ...prev, objects: [], summary: EMPTY_SUMMARY, snapshotId: null, loading: false }))
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Failed to load objects.')
      }
      const data = await res.json()
      setState((prev) => ({
        ...prev,
        objects: data.objects ?? [],
        summary: {
          total: data.summary?.totalCount ?? 0,
          selected: data.summary?.selectedCount ?? 0,
          system: data.objects?.filter((o: ObjectWithSelection) => o.category === 'system').length ?? 0,
          custom: data.objects?.filter((o: ObjectWithSelection) => o.category === 'custom').length ?? 0,
        },
        snapshotId: data.snapshotId ?? null,
        connectionId: data.connectionId ?? null,
        loading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [planId])

  useEffect(() => {
    fetchObjects()
  }, [fetchObjects])

  /** Optimistic single-toggle with revert on failure. */
  const toggleSelect = useCallback(
    async (objectApiName: string, isSelected: boolean) => {
      // Optimistic update
      setState((prev) => ({
        ...prev,
        objects: prev.objects.map((o) => (o.apiName === objectApiName ? { ...o, isSelected } : o)),
        summary: {
          ...prev.summary,
          selected: prev.summary.selected + (isSelected ? 1 : -1),
        },
      }))

      try {
        const res = await fetch(`/api/plans/${planId}/source/objects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selections: [{ objectApiName, isSelected }] }),
        })
        if (!res.ok) {
          // Revert
          setState((prev) => ({
            ...prev,
            objects: prev.objects.map((o) => (o.apiName === objectApiName ? { ...o, isSelected: !isSelected } : o)),
            summary: {
              ...prev.summary,
              selected: prev.summary.selected + (isSelected ? -1 : 1),
            },
            error: 'Failed to update selection.',
          }))
        }
      } catch {
        setState((prev) => ({
          ...prev,
          objects: prev.objects.map((o) => (o.apiName === objectApiName ? { ...o, isSelected: !isSelected } : o)),
          summary: {
            ...prev.summary,
            selected: prev.summary.selected + (isSelected ? -1 : 1),
          },
          error: 'Failed to update selection.',
        }))
      }
    },
    [planId],
  )

  const selectAll = useCallback(async () => {
    const visible = state.includeSystem
      ? state.objects
      : state.objects.filter((o) => o.category !== 'system')

    // Optimistic
    setState((prev) => ({
      ...prev,
      saving: true,
      objects: prev.objects.map((o) =>
        state.includeSystem || o.category !== 'system' ? { ...o, isSelected: true } : o,
      ),
      summary: { ...prev.summary, selected: visible.length },
    }))

    const selections = visible.map((o) => ({ objectApiName: o.apiName, isSelected: true }))
    try {
      await fetch(`/api/plans/${planId}/source/objects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
    } catch {
      await fetchObjects()
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [planId, state.objects, state.includeSystem, fetchObjects])

  const deselectAll = useCallback(async () => {
    const visible = state.includeSystem
      ? state.objects
      : state.objects.filter((o) => o.category !== 'system')

    // Optimistic
    setState((prev) => ({
      ...prev,
      saving: true,
      objects: prev.objects.map((o) =>
        state.includeSystem || o.category !== 'system' ? { ...o, isSelected: false } : o,
      ),
      summary: { ...prev.summary, selected: 0 },
    }))

    const selections = visible.map((o) => ({ objectApiName: o.apiName, isSelected: false }))
    try {
      await fetch(`/api/plans/${planId}/source/objects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
    } catch {
      await fetchObjects()
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [planId, state.objects, state.includeSystem, fetchObjects])

  const toggleSystem = useCallback(() => {
    setState((prev) => ({ ...prev, includeSystem: !prev.includeSystem }))
  }, [])

  // Client-side filtering: hide system objects when includeSystem=false
  const filteredObjects = state.includeSystem
    ? state.objects
    : state.objects.filter((o) => o.category !== 'system')

  return {
    objects: filteredObjects,
    allObjects: state.objects,
    summary: state.summary,
    snapshotId: state.snapshotId,
    connectionId: state.connectionId,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    includeSystem: state.includeSystem,
    toggleSelect,
    selectAll,
    deselectAll,
    toggleSystem,
    refresh: fetchObjects,
  }
}
