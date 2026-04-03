// 004-source-object-selection — Composed list with search, toolbar, rows, and expand panels

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { SelectionToolbar } from './selection-toolbar'
import { ObjectRow } from './object-row'
import { ObjectExpandPanel } from './object-expand-panel'
import type { ObjectWithSelection } from '@/hooks/use-object-selection'
import type { SelectionSummary } from '@/hooks/use-object-selection'

interface ObjectSelectionListProps {
  planId: string
  objects: ObjectWithSelection[]
  summary: SelectionSummary
  includeSystem: boolean
  onToggleSelect: (objectId: string, isSelected: boolean) => void
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  function handleToggleExpand(objectId: string) {
    setExpandedId((prev) => (prev === objectId ? null : objectId))
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
      {/* Search */}
      <Input
        placeholder="Search objects by name or label..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* List */}
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
            <div key={obj.id}>
              <ObjectRow
                object={obj}
                isExpanded={expandedId === obj.id}
                onToggleSelect={onToggleSelect}
                onToggleExpand={handleToggleExpand}
              />
              {expandedId === obj.id && (
                <ObjectExpandPanel
                  planId={planId}
                  objectId={obj.id}
                  objectApiName={obj.apiName}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
