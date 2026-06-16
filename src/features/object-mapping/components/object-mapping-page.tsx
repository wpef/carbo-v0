// 011-object-mapping — T016: object-mapping page shell (client component)
// Wraps ObjectMappingView with the useObjectMappings hook.
// Auto-link fires automatically on first load if objectAutoLinkedAt is null (FR-004).

'use client'

import { useObjectMappings } from '../hooks/useObjectMappings'
import { ObjectMappingView } from './ObjectMappingView'

export function ObjectMappingPage({ planId }: { planId: string }) {
  const {
    sourceObjects,
    destObjects,
    mappings,
    loading,
    error,
    createMapping,
    deleteMapping,
  } = useObjectMappings(planId)

  return (
    <ObjectMappingView
      planId={planId}
      sourceObjects={sourceObjects}
      destObjects={destObjects}
      mappings={mappings}
      loading={loading}
      error={error}
      onCreateMapping={createMapping}
      onDeleteMapping={deleteMapping}
    />
  )
}
