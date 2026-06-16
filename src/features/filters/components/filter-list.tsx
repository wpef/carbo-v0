// 015-migration-filters — List of filters with AND separators + add form
// Ported from v3 src/components/filters/filter-list.tsx.

'use client'

import { useState } from 'react'
import { FilterRow } from './filter-row'
import { FilterForm } from './filter-form'
import type { FilterItem, CreateFilterInput, FilterableField } from '../types'

interface FilterListProps {
  filters: FilterItem[]
  filterableFields: FilterableField[]
  onDelete: (filterId: string) => Promise<{ error?: string }>
  onToggle: (filterId: string) => Promise<{ error?: string }>
  onCreate: (input: CreateFilterInput) => Promise<{ error?: string; warning?: string }>
}

export function FilterList({
  filters,
  filterableFields,
  onDelete,
  onToggle,
  onCreate,
}: FilterListProps) {
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null)

  const handleDelete = async (filterId: string) => {
    setDeleteInProgress(filterId)
    await onDelete(filterId)
    setDeleteInProgress(null)
  }

  return (
    <div className="space-y-3">
      {/* Existing filters with AND separators */}
      {filters.length > 0 ? (
        <div className="space-y-1">
          {filters.map((filter, index) => (
            <div key={filter.id}>
              {index > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t border-border/50" />
                  <span className="text-xs text-muted-foreground font-mono uppercase px-1">
                    ET
                  </span>
                  <div className="flex-1 border-t border-border/50" />
                </div>
              )}
              <FilterRow
                filter={filter}
                onDelete={handleDelete}
                onToggle={onToggle}
                deleting={deleteInProgress === filter.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg">
          Aucun filtre défini. Tous les enregistrements seront migrés.
        </p>
      )}

      {/* Add filter form */}
      {filterableFields.length > 0 && (
        <FilterForm filterableFields={filterableFields} onSubmit={onCreate} />
      )}

      {filterableFields.length === 0 && filters.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Aucun champ source disponible pour le filtrage. Récupérez d&apos;abord les champs sources.
        </p>
      )}
    </div>
  )
}
