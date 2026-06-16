// 015-migration-filters — Filter panel composing the filter list + estimated count
// Ported from v3 src/components/filters/filter-panel.tsx, adapted to v4 structure.

'use client'

import { useState } from 'react'
import { useMigrationFilters } from '../hooks/use-migration-filters'
import { useFilterEstimate } from '../hooks/use-filter-estimate'
import { FilterList } from './filter-list'

interface FilterPanelProps {
  planId: string
  mappingId: string
  /** Optional label for the source object, displayed in the heading */
  sourceObjectLabel?: string
}

/**
 * Collapsible panel showing migration filters and estimated record count.
 * Renders: heading, FilterList (rows + form), estimated count footer.
 *
 * Used in the field mapping page (012), above the field mapping table.
 */
export function FilterPanel({ planId, mappingId, sourceObjectLabel }: FilterPanelProps) {
  const [open, setOpen] = useState(true)
  const [estimateVersion, setEstimateVersion] = useState(0)

  const {
    filters,
    filterableFields,
    count,
    loading,
    error,
    createFilter,
    deleteFilter,
    toggleFilter,
  } = useMigrationFilters(planId, mappingId)

  const { estimate, isLoading: estimateLoading } = useFilterEstimate(planId, mappingId, estimateVersion)

  const activeCount = filters.filter((f) => f.isActive).length

  const handleCreate = async (...args: Parameters<typeof createFilter>) => {
    const result = await createFilter(...args)
    if (!result.error) setEstimateVersion((v) => v + 1)
    return result
  }

  const handleDelete = async (filterId: string) => {
    const result = await deleteFilter(filterId)
    if (!result.error) setEstimateVersion((v) => v + 1)
    return result
  }

  const handleToggle = async (filterId: string) => {
    const result = await toggleFilter(filterId)
    if (!result.error) setEstimateVersion((v) => v + 1)
    return result
  }

  // Estimated count display
  let estimateText: string
  if (estimateLoading) {
    estimateText = 'Calcul de l\'estimation...'
  } else if (!estimate || !estimate.isEstimateAvailable) {
    estimateText = estimate?.message ?? 'Estimation indisponible.'
  } else if (!estimate.isFiltered) {
    estimateText = `${estimate.totalCount?.toLocaleString('fr-FR') ?? '?'} enregistrements (aucun filtre actif)`
  } else {
    const est = estimate.estimatedCount?.toLocaleString('fr-FR') ?? '?'
    const total = estimate.totalCount?.toLocaleString('fr-FR') ?? '?'
    estimateText = `~${est} sur ${total} enregistrements correspondent aux filtres`
    if (estimate.message) estimateText += ` — ${estimate.message}`
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header — clickable to toggle collapse */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <span className="text-sm font-medium">
            Filtres de migration
            {sourceObjectLabel && (
              <span className="text-muted-foreground font-normal"> — {sourceObjectLabel}</span>
            )}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {count === 0
              ? 'Aucun filtre — tous les enregistrements seront migrés.'
              : activeCount === 0
                ? `${count} filtre${count !== 1 ? 's' : ''} (tous inactifs)`
                : `${activeCount} filtre${activeCount !== 1 ? 's' : ''} actif${activeCount !== 1 ? 's' : ''} sur ${count}`}
          </p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Chargement des filtres...
            </div>
          ) : (
            <FilterList
              filters={filters}
              filterableFields={filterableFields}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onCreate={handleCreate}
            />
          )}

          {/* Estimated count footer */}
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">{estimateText}</p>
          </div>
        </div>
      )}
    </div>
  )
}
