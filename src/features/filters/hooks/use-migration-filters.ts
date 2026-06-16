// 015-migration-filters — Hook for migration filter CRUD + filterable fields
// Ported from v3 src/hooks/use-migration-filters.ts, adapted to v4 structure.

'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  FilterItem,
  FilterableField,
  CreateFilterInput,
  UpdateFilterInput,
} from '../types'

interface MigrationFiltersState {
  filters: FilterItem[]
  filterableFields: FilterableField[]
  count: number
  loading: boolean
  error: string
}

export function useMigrationFilters(planId: string, mappingId: string) {
  const [state, setState] = useState<MigrationFiltersState>({
    filters: [],
    filterableFields: [],
    count: 0,
    loading: true,
    error: '',
  })

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [filtersRes, fieldsRes] = await Promise.all([
        fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filters`),
        fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filterable-fields`),
      ])

      const [filtersData, fieldsData] = await Promise.all([
        filtersRes.ok ? filtersRes.json() : { filters: [], count: 0 },
        fieldsRes.ok ? fieldsRes.json() : { fields: [] },
      ])

      setState({
        filters: filtersData.filters ?? [],
        count: filtersData.count ?? 0,
        filterableFields: fieldsData.fields ?? [],
        loading: false,
        error: '',
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Échec du chargement des filtres.',
      }))
    }
  }, [planId, mappingId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createFilter = useCallback(
    async (input: CreateFilterInput): Promise<{ error?: string; warning?: string }> => {
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok) {
          return { error: data.error ?? 'Création du filtre échouée.' }
        }
        await fetchAll()
        return { warning: data.warning }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Création du filtre échouée.' }
      }
    },
    [planId, mappingId, fetchAll],
  )

  const updateFilter = useCallback(
    async (filterId: string, updates: UpdateFilterInput): Promise<{ error?: string }> => {
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${mappingId}/filters/${filterId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          },
        )
        const data = await res.json()
        if (!res.ok) {
          return { error: data.error ?? 'Mise à jour du filtre échouée.' }
        }
        await fetchAll()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Mise à jour du filtre échouée.' }
      }
    },
    [planId, mappingId, fetchAll],
  )

  const deleteFilter = useCallback(
    async (filterId: string): Promise<{ error?: string }> => {
      // Optimistic removal
      setState((prev) => ({
        ...prev,
        filters: prev.filters.filter((f) => f.id !== filterId),
        count: Math.max(0, prev.count - 1),
      }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${mappingId}/filters/${filterId}`,
          { method: 'DELETE' },
        )
        if (!res.ok && res.status !== 204) {
          const data = await res.json().catch(() => ({}))
          await fetchAll() // rollback
          return { error: data.error ?? 'Suppression du filtre échouée.' }
        }
        return {}
      } catch (err) {
        await fetchAll() // rollback
        return { error: err instanceof Error ? err.message : 'Suppression du filtre échouée.' }
      }
    },
    [planId, mappingId, fetchAll],
  )

  /**
   * Toggle the isActive state of a filter (optimistic update).
   */
  const toggleFilter = useCallback(
    async (filterId: string): Promise<{ error?: string }> => {
      // Optimistic toggle
      const current = state.filters.find((f) => f.id === filterId)
      const newIsActive = current ? !current.isActive : true
      setState((prev) => ({
        ...prev,
        filters: prev.filters.map((f) =>
          f.id === filterId ? { ...f, isActive: newIsActive } : f,
        ),
      }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${mappingId}/filters/${filterId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: newIsActive }),
          },
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          await fetchAll() // rollback
          return { error: data.error ?? 'Bascule du filtre échouée.' }
        }
        return {}
      } catch (err) {
        await fetchAll() // rollback
        return { error: err instanceof Error ? err.message : 'Bascule du filtre échouée.' }
      }
    },
    [planId, mappingId, state.filters, fetchAll],
  )

  return {
    filters: state.filters,
    filterableFields: state.filterableFields,
    count: state.count,
    loading: state.loading,
    error: state.error,
    createFilter,
    updateFilter,
    deleteFilter,
    toggleFilter,
    refresh: fetchAll,
  }
}
