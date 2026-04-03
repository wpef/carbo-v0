// 015-migration-filters — Panel composing the filter list within an object mapping context

'use client'

import { useMigrationFilters } from '@/hooks/use-migration-filters'
import { FilterList } from './filter-list'

interface FilterPanelProps {
  planId: string
  mappingId: string
  sourceObjectLabel?: string
}

export function FilterPanel({ planId, mappingId, sourceObjectLabel }: FilterPanelProps) {
  const {
    filters,
    filterableFields,
    loading,
    error,
    createFilter,
    deleteFilter,
    toggleFilter,
  } = useMigrationFilters(planId, mappingId)

  const activeCount = filters.filter((f) => f.isActive).length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            Source Filters
            {sourceObjectLabel && (
              <span className="text-muted-foreground font-normal"> — {sourceObjectLabel}</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filters.length === 0
              ? 'No filters — all records will be migrated.'
              : activeCount === 0
                ? `${filters.length} filter${filters.length !== 1 ? 's' : ''} (all inactive)`
                : `${activeCount} active filter${activeCount !== 1 ? 's' : ''} of ${filters.length}`}
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Loading filters...</div>
      ) : (
        <FilterList
          filters={filters}
          filterableFields={filterableFields}
          onDelete={deleteFilter}
          onToggle={toggleFilter}
          onCreate={createFilter}
        />
      )}
    </div>
  )
}
