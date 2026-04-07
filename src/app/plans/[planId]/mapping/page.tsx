'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useObjectMapping } from '@/hooks/use-object-mapping'
import { ObjectMappingView } from '@/components/mapping/ObjectMappingView'
import { Button } from '@/components/ui/button'
import { StepNavigation } from '@/components/plans/step-navigation'

export default function MappingPage() {
  const params = useParams<{ planId: string }>()
  const router = useRouter()
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

  async function handleNext() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'FIELD_MAPPING' }),
    })
    router.push(`/plans/${planId}/field-mapping`)
  }

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
        <div className="space-y-8">
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

          {mappings.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {mappings.length} object pair{mappings.length !== 1 ? 's' : ''} mapped.
                {unmappedObjects.length > 0 && ` ${unmappedObjects.length} unmapped.`}
              </p>
              <Button onClick={handleNext}>
                Next: Field Mapping &rarr;
              </Button>
            </div>
          )}
        </div>
      )}
      <StepNavigation planId={params.planId} currentStep="MAPPING" />
    </main>
  )
}
