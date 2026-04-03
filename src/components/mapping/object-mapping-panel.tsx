// 011-object-mapping — Panel composing the list + unmapped warning

'use client'

import { ObjectMappingList } from './object-mapping-list'
import type { ObjectMappingDTO, UnmappedSourceObject, AvailableDestObject } from '@/lib/types/mapping'

interface ObjectMappingPanelProps {
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

export function ObjectMappingPanel({
  planId,
  mappings,
  unmappedObjects,
  destObjects,
  onDelete,
  onCreate,
}: ObjectMappingPanelProps) {
  return (
    <div className="space-y-4">
      {unmappedObjects.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{unmappedObjects.length}</strong> selected source object
          {unmappedObjects.length !== 1 ? 's have' : ' has'} no mapping yet:{' '}
          {unmappedObjects
            .slice(0, 3)
            .map((o) => o.label)
            .join(', ')}
          {unmappedObjects.length > 3 && ` and ${unmappedObjects.length - 3} more`}.
        </div>
      )}

      <ObjectMappingList
        planId={planId}
        mappings={mappings}
        unmappedObjects={unmappedObjects}
        destObjects={destObjects}
        onDelete={onDelete}
        onCreate={onCreate}
      />
    </div>
  )
}
