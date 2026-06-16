// 004-source-object-selection — Single object row with checkbox and expand button

'use client'

import { Badge } from '@/components/ui/badge'
import type { ObjectWithSelection } from '@/features/schema/hooks/use-object-selection'

interface ObjectRowProps {
  object: ObjectWithSelection
  isExpanded: boolean
  onToggleSelect: (objectApiName: string, isSelected: boolean) => void
  onToggleExpand: (objectApiName: string) => void
}

export function ObjectRow({ object, isExpanded, onToggleSelect, onToggleExpand }: ObjectRowProps) {
  return (
    <div className={`border-b last:border-b-0 ${isExpanded ? 'bg-muted/30' : 'bg-background'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          id={`select-${object.apiName}`}
          checked={object.isSelected}
          onChange={(e) => onToggleSelect(object.apiName, e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        />

        <label
          htmlFor={`select-${object.apiName}`}
          className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
        >
          <span className="font-medium text-sm">{object.label}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{object.apiName}</span>
          {object.isCustom && (
            <Badge variant="secondary" className="text-xs shrink-0">Custom</Badge>
          )}
          {object.description && (
            <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-xs">
              {object.description}
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => onToggleExpand(object.apiName)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors shrink-0"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  )
}
