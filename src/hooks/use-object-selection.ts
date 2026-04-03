// 004-source-object-selection — Hook for object selection API calls

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ObjectWithSelection {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  selectionId: string | null
  isSelected: boolean
  selectedAt: string | null
}

export interface SelectionSummary {
  total: number
  selected: number
  system: number
  custom: number
}

interface ObjectSelectionState {
  snapshotId: string | null
  objects: ObjectWithSelection[]
  summary: SelectionSummary
  loading: boolean
  saving: boolean
  error: string
  includeSystem: boolean
}

const EMPTY_SUMMARY: SelectionSummary = { total: 0, selected: 0, system: 0, custom: 0 }

export function useObjectSelection(planId: string) {
  const [state, setState] = useState<ObjectSelectionState>({
    snapshotId: null,
    objects: [],
    summary: EMPTY_SUMMARY,
    loading: true,
    saving: false,
    error: '',
    includeSystem: false,
  })

  const fetchObjects = useCallback(
    async (includeSystem: boolean) => {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/source/objects?includeSystem=${includeSystem}`,
        )
        if (res.status === 404) {
          setState((prev) => ({
            ...prev,
            snapshotId: null,
            objects: [],
            summary: EMPTY_SUMMARY,
            loading: false,
          }))
          return
        }
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message ?? 'Failed to load objects.')
        }
        const data: { snapshotId: string; objects: ObjectWithSelection[]; summary: SelectionSummary } =
          await res.json()
        setState((prev) => ({
          ...prev,
          snapshotId: data.snapshotId,
          objects: data.objects,
          summary: data.summary,
          loading: false,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [planId],
  )

  useEffect(() => {
    fetchObjects(state.includeSystem)
  }, [fetchObjects, state.includeSystem])

  const toggleSelect = useCallback(
    async (objectId: string, isSelected: boolean) => {
      // Optimistic update
      setState((prev) => ({
        ...prev,
        objects: prev.objects.map((o) =>
          o.id === objectId ? { ...o, isSelected } : o,
        ),
        summary: {
          ...prev.summary,
          selected: prev.summary.selected + (isSelected ? 1 : -1),
        },
      }))

      try {
        const res = await fetch(`/api/plans/${planId}/source/objects/${objectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isSelected }),
        })
        if (!res.ok) {
          // Revert on failure
          setState((prev) => ({
            ...prev,
            objects: prev.objects.map((o) =>
              o.id === objectId ? { ...o, isSelected: !isSelected } : o,
            ),
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
          objects: prev.objects.map((o) =>
            o.id === objectId ? { ...o, isSelected: !isSelected } : o,
          ),
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
    const selections = state.objects.map((o) => ({ objectId: o.id, isSelected: true }))

    setState((prev) => ({
      ...prev,
      saving: true,
      objects: prev.objects.map((o) => ({ ...o, isSelected: true })),
      summary: { ...prev.summary, selected: prev.objects.length },
    }))

    try {
      await fetch(`/api/plans/${planId}/source/objects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
    } catch {
      // Refresh to get accurate state
      await fetchObjects(state.includeSystem)
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [planId, state.objects, state.includeSystem, fetchObjects])

  const deselectAll = useCallback(async () => {
    const selections = state.objects.map((o) => ({ objectId: o.id, isSelected: false }))

    setState((prev) => ({
      ...prev,
      saving: true,
      objects: prev.objects.map((o) => ({ ...o, isSelected: false })),
      summary: { ...prev.summary, selected: 0 },
    }))

    try {
      await fetch(`/api/plans/${planId}/source/objects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
    } catch {
      await fetchObjects(state.includeSystem)
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [planId, state.objects, state.includeSystem, fetchObjects])

  const toggleSystem = useCallback(() => {
    setState((prev) => ({ ...prev, includeSystem: !prev.includeSystem }))
  }, [])

  return {
    snapshotId: state.snapshotId,
    objects: state.objects,
    summary: state.summary,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    includeSystem: state.includeSystem,
    toggleSelect,
    selectAll,
    deselectAll,
    toggleSystem,
  }
}
