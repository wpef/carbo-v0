// 004-source-object-selection — Toolbar with counter and bulk actions

'use client'

import type { SelectionSummary } from '@/features/schema/hooks/use-object-selection'

interface SelectionToolbarProps {
  summary: SelectionSummary
  includeSystem: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggleSystem: () => void
}

export function SelectionToolbar({
  summary,
  includeSystem,
  onSelectAll,
  onDeselectAll,
  onToggleSystem,
}: SelectionToolbarProps) {
  const visibleTotal = includeSystem ? summary.total : summary.total - summary.system

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50 border-b rounded-t-lg">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{summary.selected} selected</span>
        <span className="text-muted-foreground">of {visibleTotal} objects</span>
        {summary.custom > 0 && (
          <span className="text-muted-foreground text-xs">({summary.custom} custom)</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSystem}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
        >
          {includeSystem ? 'Hide system' : 'Show system'}
          {summary.system > 0 && (
            <span className="ml-1 text-muted-foreground">({summary.system})</span>
          )}
        </button>

        <div className="w-px h-4 bg-border" />

        <button
          type="button"
          onClick={onSelectAll}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
        >
          Deselect all
        </button>
      </div>
    </div>
  )
}
