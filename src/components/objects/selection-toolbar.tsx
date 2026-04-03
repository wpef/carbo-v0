// 004-source-object-selection — Toolbar with selection counter and bulk actions

import { Button } from '@/components/ui/button'

interface SelectionSummary {
  total: number
  selected: number
  system: number
  custom: number
}

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
      {/* Counter */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">
          {summary.selected} selected
        </span>
        <span className="text-muted-foreground">of {visibleTotal} objects</span>
        {summary.custom > 0 && (
          <span className="text-muted-foreground text-xs">
            ({summary.custom} custom)
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSystem}
          className="text-xs"
        >
          {includeSystem ? 'Hide system' : 'Show system'}
          {summary.system > 0 && (
            <span className="ml-1 text-muted-foreground">({summary.system})</span>
          )}
        </Button>

        <div className="w-px h-4 bg-border" />

        <Button variant="ghost" size="sm" onClick={onSelectAll} className="text-xs">
          Select all
        </Button>
        <Button variant="ghost" size="sm" onClick={onDeselectAll} className="text-xs">
          Deselect all
        </Button>
      </div>
    </div>
  )
}
