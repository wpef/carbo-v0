// 004-source-object-selection — List with real-time search, toolbar, rows, expand panels

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { SelectionToolbar } from './selection-toolbar'
import { ObjectRow } from './object-row'
import { ObjectExpandPanel } from './object-expand-panel'
import type { ObjectWithSelection, SelectionSummary } from '@/features/schema/hooks/use-object-selection'

interface ObjectSelectionListProps {
  planId: string
  objects: ObjectWithSelection[]
  summary: SelectionSummary
  includeSystem: boolean
  onToggleSelect: (objectApiName: string, isSelected: boolean) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onToggleSystem: () => void
}

export function ObjectSelectionList({
  planId,
  objects,
  summary,
  includeSystem,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onToggleSystem,
}: ObjectSelectionListProps) {
  const [search, setSearch] = useState('')
  const [expandedApiName, setExpandedApiName] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return objects
    return objects.filter(
      (o) =>
        o.apiName.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q),
    )
  }, [objects, search])

  function handleToggleExpand(objectApiName: string) {
    setExpandedApiName((prev) => (prev === objectApiName ? null : objectApiName))
  }

  if (objects.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground text-sm">No objects found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Real-time search */}
      <Input
        placeholder="Search objects by name or label..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg overflow-hidden">
        <SelectionToolbar
          summary={summary}
          includeSystem={includeSystem}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onToggleSystem={onToggleSystem}
        />

        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No objects match &ldquo;{search}&rdquo;.
          </div>
        ) : (
          filtered.map((obj) => (
            <div key={obj.apiName}>
              <ObjectRow
                object={obj}
                isExpanded={expandedApiName === obj.apiName}
                onToggleSelect={onToggleSelect}
                onToggleExpand={handleToggleExpand}
              />
              {expandedApiName === obj.apiName && (
                <ObjectExpandPanel planId={planId} objectApiName={obj.apiName} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
