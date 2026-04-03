// 011-object-mapping — List of existing mappings + "Add Mapping" creation form

'use client'

import { useState } from 'react'
import { ObjectMappingRow } from './object-mapping-row'
import { Button } from '@/components/ui/button'
import type { ObjectMappingDTO, UnmappedSourceObject, AvailableDestObject } from '@/lib/types/mapping'

interface ObjectMappingListProps {
  planId: string
  mappings: ObjectMappingDTO[]
  unmappedObjects: UnmappedSourceObject[]
  destObjects: AvailableDestObject[]
  onDelete: (mappingId: string) => Promise<{ error?: string }>
  onCreate: (
    sourceObjectId: string,
    sourceObjectApiName: string,
    destObjectId: string,
    destObjectApiName: string,
  ) => Promise<{ error?: string }>
}

export function ObjectMappingList({
  planId,
  mappings,
  unmappedObjects,
  destObjects,
  onDelete,
  onCreate,
}: ObjectMappingListProps) {
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [selectedDestId, setSelectedDestId] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const handleCreate = async () => {
    if (!selectedSourceId || !selectedDestId) return

    const sourceObj = unmappedObjects.find((o) => o.id === selectedSourceId)
    const destObj = destObjects.find((o) => o.id === selectedDestId)
    if (!sourceObj || !destObj) return

    setCreating(true)
    setFormError('')
    const result = await onCreate(sourceObj.id, sourceObj.apiName, destObj.id, destObj.apiName)
    setCreating(false)

    if (result.error) {
      setFormError(result.error)
    } else {
      setSelectedSourceId('')
      setSelectedDestId('')
    }
  }

  const handleDelete = async (mappingId: string) => {
    setDeleteInProgress(mappingId)
    await onDelete(mappingId)
    setDeleteInProgress(null)
  }

  return (
    <div className="space-y-4">
      {/* Existing mappings */}
      {mappings.length > 0 ? (
        <div className="space-y-2">
          {mappings.map((mapping) => (
            <ObjectMappingRow
              key={mapping.id}
              mapping={mapping}
              planId={planId}
              onDelete={handleDelete}
              deleting={deleteInProgress === mapping.id}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          No mappings yet. Add a mapping below.
        </p>
      )}

      {/* Add mapping form */}
      {unmappedObjects.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <h4 className="text-sm font-medium">Add Mapping</h4>
          <div className="flex items-center gap-2">
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Select source object...</option>
              {unmappedObjects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.label} ({obj.apiName})
                </option>
              ))}
            </select>

            <span className="text-muted-foreground shrink-0">&#8594;</span>

            <select
              value={selectedDestId}
              onChange={(e) => setSelectedDestId(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Select destination object...</option>
              {destObjects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.label} ({obj.apiName})
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!selectedSourceId || !selectedDestId || creating}
            >
              {creating ? 'Adding...' : 'Add'}
            </Button>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      )}
    </div>
  )
}
