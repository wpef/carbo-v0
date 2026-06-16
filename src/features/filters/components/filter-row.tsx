// 015-migration-filters — Single filter row display
// Ported from v3 src/components/filters/filter-row.tsx, adapted to v4 types.

'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FILTER_OPERATORS } from '../lib/filter-operators'
import type { FilterItem } from '../types'

interface FilterRowProps {
  filter: FilterItem
  onDelete: (filterId: string) => void
  onToggle: (filterId: string) => void
  deleting?: boolean
}

export function FilterRow({ filter, onDelete, onToggle, deleting }: FilterRowProps) {
  const operatorMeta = FILTER_OPERATORS.find((op) => op.value === filter.operator)
  const operatorLabel = operatorMeta?.label ?? filter.operator
  const fieldDisplay = filter.fieldLabel ?? filter.fieldApiName

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        filter.isActive
          ? 'border-border bg-background'
          : 'border-border/50 bg-muted/30 opacity-60'
      }`}
    >
      {/* Field name */}
      <span className="text-sm font-medium font-mono min-w-0 shrink-0">{fieldDisplay}</span>

      {/* Operator */}
      <span className="text-xs text-muted-foreground shrink-0">{operatorLabel}</span>

      {/* Value — hidden for IS_NULL (needsValue: false) */}
      {operatorMeta?.needsValue && filter.value !== null && filter.value !== undefined && (
        <span className="text-sm font-mono bg-muted rounded px-1.5 py-0.5 text-xs min-w-0 truncate">
          &quot;{filter.value}&quot;
        </span>
      )}

      {/* Warning badge */}
      {filter.warning && (
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-1 shrink-0">
          Avertissement
        </Badge>
      )}

      <div className="flex items-center gap-1 ml-auto shrink-0">
        {/* Active toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle(filter.id)}
          aria-label={filter.isActive ? 'Désactiver le filtre' : 'Activer le filtre'}
          className="text-xs text-muted-foreground h-6 px-2"
        >
          {filter.isActive ? 'ON' : 'OFF'}
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(filter.id)}
          disabled={deleting}
          aria-label="Supprimer le filtre"
          className="text-muted-foreground hover:text-destructive h-6 w-6 p-0"
        >
          ×
        </Button>
      </div>
    </div>
  )
}
