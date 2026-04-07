// 012-field-mapping — Field mapping detail page for a specific object mapping

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useFieldMapping } from '@/hooks/use-field-mapping'
import { FieldMappingView } from '@/components/mapping/FieldMappingView'
import { FilterPanel } from '@/components/filters/filter-panel'

export default function FieldMappingPage() {
  const params = useParams<{ planId: string; mappingId: string }>()
  const planId = params.planId
  const mappingId = params.mappingId

  const {
    fieldMappings,
    unmappedSourceFields,
    availableDestFields,
    loading,
    error,
    linkState,
    selectedSourceFieldId,
    createLink,
    deleteLink,
    triggerAutoMatch,
    selectSourceField,
  } = useFieldMapping(planId, mappingId)

  // Derive object labels from the first field mapping (or use IDs as fallback)
  const sourceObjectLabel =
    fieldMappings.length > 0 ? fieldMappings[0].sourceFieldApiName.split('.')[0] : 'Source'
  const destObjectLabel =
    fieldMappings.length > 0 ? fieldMappings[0].destFieldApiName.split('.')[0] : 'Destination'

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href={`/plans/${planId}/mapping`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to object mapping
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Field Mapping</h1>
        <p className="text-muted-foreground text-sm">
          Link source fields to destination fields. Click the circle on a source field to start a
          link, then click a destination field to complete it.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading field mapping data...</p>
      ) : (
        <div className="space-y-10">
          <FieldMappingView
            planId={planId}
            objectMappingId={mappingId}
            sourceObjectLabel={sourceObjectLabel}
            destObjectLabel={destObjectLabel}
            fieldMappings={fieldMappings}
            unmappedSourceFields={unmappedSourceFields}
            availableDestFields={availableDestFields}
            linkState={linkState}
            selectedSourceFieldId={selectedSourceFieldId}
            onSelectSource={selectSourceField}
            onCreateLink={createLink}
            onDeleteLink={deleteLink}
            onAutoMatch={triggerAutoMatch}
            error={error}
          />

          {/* Source filters for this object mapping */}
          <section className="border-t pt-8">
            <FilterPanel
              planId={planId}
              mappingId={mappingId}
              sourceObjectLabel={sourceObjectLabel}
            />
          </section>
        </div>
      )}
    </main>
  )
}
