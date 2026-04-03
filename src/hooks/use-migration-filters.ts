// 015-migration-filters — Hook for migration filter CRUD

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MigrationFilterDTO, CreateFilterInput, UpdateFilterInput, FilterableField } from '@/lib/types/filter'

interface MigrationFiltersState {
  filters: MigrationFilterDTO[]
  filterableFields: FilterableField[]
  loading: boolean
  error: string
}

export function useMigrationFilters(planId: string, mappingId: string) {
  const [state, setState] = useState<MigrationFiltersState>({
    filters: [],
    filterableFields: [],
    loading: true,
    error: '',
  })

  const fetchFilters = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [filtersRes, fieldsRes] = await Promise.all([
        fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filters`),
        fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filterable-fields`),
      ])

      const [filtersData, fieldsData] = await Promise.all([
        filtersRes.ok ? filtersRes.json() : { filters: [] },
        fieldsRes.ok ? fieldsRes.json() : { fields: [] },
      ])

      setState({
        filters: filtersData.filters ?? [],
        filterableFields: fieldsData.fields ?? [],
        loading: false,
        error: '',
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load filters.',
      }))
    }
  }, [planId, mappingId])

  useEffect(() => {
    fetchFilters()
  }, [fetchFilters])

  const createFilter = useCallback(
    async (input: CreateFilterInput): Promise<{ error?: string }> => {
      try {
        const res = await fetch(`/api/plans/${planId}/object-mappings/${mappingId}/filters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok) {
          return { error: data.message ?? 'Failed to create filter.' }
        }
        await fetchFilters()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to create filter.' }
      }
    },
    [planId, mappingId, fetchFilters],
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
          return { error: data.message ?? 'Failed to update filter.' }
        }
        await fetchFilters()
        return {}
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to update filter.' }
      }
    },
    [planId, mappingId, fetchFilters],
  )

  const deleteFilter = useCallback(
    async (filterId: string): Promise<{ error?: string }> => {
      // Optimistic removal
      setState((prev) => ({
        ...prev,
        filters: prev.filters.filter((f) => f.id !== filterId),
      }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${mappingId}/filters/${filterId}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          const data = await res.json()
          // Rollback on failure
          await fetchFilters()
          return { error: data.message ?? 'Failed to delete filter.' }
        }
        return {}
      } catch (err) {
        await fetchFilters()
        return { error: err instanceof Error ? err.message : 'Failed to delete filter.' }
      }
    },
    [planId, mappingId, fetchFilters],
  )

  const toggleFilter = useCallback(
    async (filterId: string): Promise<{ error?: string }> => {
      // Optimistic toggle
      setState((prev) => ({
        ...prev,
        filters: prev.filters.map((f) =>
          f.id === filterId ? { ...f, isActive: !f.isActive } : f,
        ),
      }))
      try {
        const res = await fetch(
          `/api/plans/${planId}/object-mappings/${mappingId}/filters/${filterId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !state.filters.find((f) => f.id === filterId)?.isActive }),
          },
        )
        if (!res.ok) {
          const data = await res.json()
          await fetchFilters()
          return { error: data.message ?? 'Failed to toggle filter.' }
        }
        return {}
      } catch (err) {
        await fetchFilters()
        return { error: err instanceof Error ? err.message : 'Failed to toggle filter.' }
      }
    },
    [planId, mappingId, fetchFilters, state.filters],
  )

  return {
    filters: state.filters,
    filterableFields: state.filterableFields,
    loading: state.loading,
    error: state.error,
    createFilter,
    updateFilter,
    deleteFilter,
    toggleFilter,
    refresh: fetchFilters,
  }
}
