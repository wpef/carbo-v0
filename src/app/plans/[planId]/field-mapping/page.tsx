'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFieldMapping } from '@/hooks/use-field-mapping'
import { FieldMappingView } from '@/components/mapping/FieldMappingView'
import { FilterPanel } from '@/components/filters/filter-panel'
import { MigrationPreviewPanel } from '@/components/mapping/MigrationPreviewPanel'
import { Button } from '@/components/ui/button'
import { StepNavigation } from '@/components/plans/step-navigation'
import type { ObjectMappingDTO } from '@/lib/types/mapping'

// ---------------------------------------------------------------------------
// Field mapping stats for badge
// ---------------------------------------------------------------------------

interface MappingStats {
  mapped: number
  total: number
  hasIncompatible: boolean
}

function useMappingStats(planId: string, mappingId: string, version: number): MappingStats | null {
  const [stats, setStats] = useState<MappingStats | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/plans/${planId}/object-mappings/${mappingId}/fields`).then((r) => r.json()),
      fetch(`/api/plans/${planId}/object-mappings/${mappingId}/fields/unmapped`).then((r) => r.json()),
    ])
      .then(([fieldsData, unmappedData]) => {
        const mappings = fieldsData.fieldMappings ?? []
        const unmapped = unmappedData.fields ?? unmappedData.unmappedFields ?? []
        const hasIncompatible = mappings.some(
          (m: { linkStatus: string }) => m.linkStatus === 'RED_SOLID' || m.linkStatus === 'RED_DASHED'
        )
        setStats({
          mapped: mappings.length,
          total: mappings.length + unmapped.length,
          hasIncompatible,
        })
      })
      .catch(() => {})
  }, [planId, mappingId, version])

  return stats
}

// ---------------------------------------------------------------------------
// Tab badge
// ---------------------------------------------------------------------------

function TabBadge({ planId, mappingId, version }: { planId: string; mappingId: string; version: number }) {
  const stats = useMappingStats(planId, mappingId, version)
  if (!stats) return null

  const color =
    stats.hasIncompatible
      ? 'bg-red-100 text-red-700 border-red-200'
      : stats.mapped === stats.total && stats.total > 0
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'bg-amber-100 text-amber-700 border-amber-200'

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${color}`}>
      {stats.mapped}/{stats.total}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline field mapping panel for a selected object mapping
// ---------------------------------------------------------------------------

function FieldMappingPanel({ planId, mapping, onChanged }: { planId: string; mapping: ObjectMappingDTO; onChanged: () => void }) {
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
    refresh,
  } = useFieldMapping(planId, mapping.id)

  const [showPreview, setShowPreview] = useState(false)

  const mappedCount = fieldMappings.length
  const totalSourceFields = mappedCount + unmappedSourceFields.length

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement des champs...</p>
      ) : (
        <>
          {/* Filters first */}
          <section>
            <FilterPanel
              planId={planId}
              mappingId={mapping.id}
              sourceObjectLabel={mapping.sourceObjectLabel}
            />
          </section>

          {/* Stats + preview toggle */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {mappedCount}/{totalSourceFields} champ{totalSourceFields !== 1 ? 's' : ''} source mappé{mappedCount !== 1 ? 's' : ''}.
              {unmappedSourceFields.length > 0 && (
                <span className="text-amber-600 ml-2">
                  {unmappedSourceFields.length} non mappé{unmappedSourceFields.length !== 1 ? 's' : ''}.
                </span>
              )}
            </div>
            {fieldMappings.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className={`text-xs border rounded px-3 py-1 transition-colors ${
                  showPreview
                    ? 'bg-muted border-foreground/30 text-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {showPreview ? 'Masquer l\'apercu' : 'Apercu de migration'}
              </button>
            )}
          </div>

          {/* Live preview panel */}
          {showPreview && fieldMappings.length > 0 && (
            <section className="rounded-lg border border-border bg-muted/20 p-4">
              <MigrationPreviewPanel
                planId={planId}
                objectMappingId={mapping.id}
                sourceObjectApiName={mapping.sourceObjectApiName}
                destObjectLabel={mapping.destObjectLabel}
                fieldMappings={fieldMappings}
              />
            </section>
          )}

          {/* Field mapping */}
          <FieldMappingView
            planId={planId}
            objectMappingId={mapping.id}
            sourceObjectLabel={mapping.sourceObjectLabel}
            destObjectLabel={mapping.destObjectLabel}
            fieldMappings={fieldMappings}
            unmappedSourceFields={unmappedSourceFields}
            availableDestFields={availableDestFields}
            linkState={linkState}
            selectedSourceFieldId={selectedSourceFieldId}
            onSelectSource={selectSourceField}
            onCreateLink={async (input) => { const r = await createLink(input); onChanged(); return r }}
            onDeleteLink={async (id) => { const r = await deleteLink(id); onChanged(); return r }}
            onAutoMatch={async () => { const r = await triggerAutoMatch(); onChanged(); return r }}
            onMigrationLogicChanged={() => { refresh(); onChanged() }}
            error={error}
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main field mapping page
// ---------------------------------------------------------------------------

export default function FieldMappingPage() {
  const params = useParams<{ planId: string }>()
  const router = useRouter()
  const planId = params.planId

  const [mappings, setMappings] = useState<ObjectMappingDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null)
  const [statsVersion, setStatsVersion] = useState(0)

  // Fetch object mappings
  useEffect(() => {
    fetch(`/api/plans/${planId}/object-mappings`)
      .then((res) => res.json())
      .then((data) => {
        const list: ObjectMappingDTO[] = data.mappings ?? data ?? []
        setMappings(list)
        if (list.length > 0) {
          setSelectedMappingId(list[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  const selectedMapping = mappings.find((m) => m.id === selectedMappingId) ?? null

  async function handleNext() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'DOCUMENTS' }),
    })
    router.push(`/plans/${planId}/documents`)
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/mapping`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to object mapping
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Field Mapping</h1>
        <p className="text-muted-foreground text-sm">
          Configure filters, field mappings, and transformation rules for each object pair.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : mappings.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-2">No object mappings found.</p>
          <Link href={`/plans/${planId}/mapping`} className="text-sm text-primary hover:underline">
            Go to object mapping first
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Object pair tabs */}
          <div className="flex flex-wrap gap-2">
            {mappings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMappingId(m.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedMappingId === m.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
              >
                <span className="font-medium">{m.sourceObjectLabel}</span>
                <span className="text-muted-foreground">&rarr;</span>
                <span className="font-medium">{m.destObjectLabel}</span>
                <TabBadge planId={planId} mappingId={m.id} version={statsVersion} />
              </button>
            ))}
          </div>

          {/* Selected mapping field panel */}
          {selectedMapping && (
            <section key={selectedMapping.id} className="rounded-lg border border-border p-6">
              <div className="mb-6">
                <h3 className="text-base font-semibold">
                  {selectedMapping.sourceObjectLabel} &rarr; {selectedMapping.destObjectLabel}
                </h3>
              </div>
              <FieldMappingPanel planId={planId} mapping={selectedMapping} onChanged={() => setStatsVersion((v) => v + 1)} />
            </section>
          )}

          {/* Navigation: next object or next step */}
          <div className="flex justify-end">
            {(() => {
              const currentIndex = mappings.findIndex((m) => m.id === selectedMappingId)
              const isLast = currentIndex === mappings.length - 1

              if (isLast) {
                return (
                  <Button onClick={handleNext}>
                    Générer les documents &rarr;
                  </Button>
                )
              }

              return (
                <Button
                  variant="outline"
                  onClick={() => setSelectedMappingId(mappings[currentIndex + 1].id)}
                >
                  Objet suivant : {mappings[currentIndex + 1].sourceObjectLabel} &rarr; {mappings[currentIndex + 1].destObjectLabel} &rarr;
                </Button>
              )
            })()}
          </div>
        </div>
      )}
      <StepNavigation planId={params.planId} currentStep="FIELD_MAPPING" />
    </main>
  )
}
