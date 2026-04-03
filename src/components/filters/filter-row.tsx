// 015-migration-filters — Single filter row display

'use client'

import { Button } from '@/components/ui/button'
import { FILTER_OPERATORS } from '@/lib/types/filter'
import type { MigrationFilterDTO } from '@/lib/types/filter'

interface FilterRowProps {
  filter: MigrationFilterDTO
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

      {/* Value */}
      {operatorMeta?.needsValue && filter.value !== null && filter.value !== undefined && (
        <span className="text-sm font-mono bg-muted rounded px-1.5 py-0.5 text-xs min-w-0 truncate">
          {filter.value}
        </span>
      )}

      <div className="flex items-center gap-1 ml-auto shrink-0">
        {/* Active toggle */}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onToggle(filter.id)}
          aria-label={filter.isActive ? 'Deactivate filter' : 'Activate filter'}
          className="text-xs text-muted-foreground"
        >
          {filter.isActive ? 'ON' : 'OFF'}
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(filter.id)}
          disabled={deleting}
          aria-label="Remove filter"
          className="text-muted-foreground hover:text-destructive"
        >
          ×
        </Button>
      </div>
    </div>
  )
}
