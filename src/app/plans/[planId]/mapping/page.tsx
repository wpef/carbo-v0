// 011-object-mapping — Object mapping page

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useObjectMapping } from '@/hooks/use-object-mapping'
import { ObjectMappingView } from '@/components/mapping/ObjectMappingView'

export default function MappingPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const {
    mappings,
    unmappedObjects,
    destObjects,
    loading,
    error,
    linkState,
    selectedSourceObjectId,
    createLink,
    deleteLink,
    triggerAutoLink,
    selectSourceObject,
  } = useObjectMapping(planId)

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Object Mapping</h1>
        <p className="text-muted-foreground text-sm">
          Link source objects to destination objects. Click the circle on a source object to start
          a link, then click a destination object to complete it.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading mapping data...</p>
      ) : (
        <ObjectMappingView
          planId={planId}
          mappings={mappings}
          unmappedObjects={unmappedObjects}
          destObjects={destObjects}
          linkState={linkState}
          selectedSourceObjectId={selectedSourceObjectId}
          onSelectSource={selectSourceObject}
          onCreateLink={createLink}
          onDeleteLink={deleteLink}
          onAutoLink={triggerAutoLink}
          error={error}
        />
      )}
    </main>
  )
}
