// 004-source-object-selection — Single object row with checkbox

import { Badge } from '@/components/ui/badge'

export interface ObjectRowItem {
  id: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  isSelected: boolean
}

interface ObjectRowProps {
  object: ObjectRowItem
  isExpanded: boolean
  onToggleSelect: (objectId: string, isSelected: boolean) => void
  onToggleExpand: (objectId: string) => void
}

export function ObjectRow({ object, isExpanded, onToggleSelect, onToggleExpand }: ObjectRowProps) {
  return (
    <div
      className={`border-b last:border-b-0 ${isExpanded ? 'bg-muted/30' : 'bg-background'}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          id={`select-${object.id}`}
          checked={object.isSelected}
          onChange={(e) => onToggleSelect(object.id, e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
        />

        {/* Label + apiName */}
        <label
          htmlFor={`select-${object.id}`}
          className="flex-1 flex items-center gap-2 cursor-pointer"
        >
          <span className="font-medium text-sm">{object.label}</span>
          <span className="text-xs text-muted-foreground font-mono">{object.apiName}</span>
          {object.isCustom && (
            <Badge variant="secondary" className="text-xs">Custom</Badge>
          )}
          {object.description && (
            <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-xs">
              {object.description}
            </span>
          )}
        </label>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => onToggleExpand(object.id)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  )
}
