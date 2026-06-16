// 012-field-mapping / Clusters 3, 6, 16 — Main field-mapping page (v4)
// - Cluster 3: linkStatus badge via enriched DTOs
// - Cluster 6: UnmappedFieldsWarning + exclude/re-include
// - Cluster 16: MigrationPreviewPanel, real-time search, TabBadge, duplicate prevention (409)
'use client'

import { useEffect, useState } from 'react'
import { useFieldMapping } from '../hooks/use-field-mapping'
import { useUnmappedFields } from '../../unmapped/hooks/use-unmapped-fields'
import { FieldMappingView, TabBadge } from './field-mapping-view'
import { MigrationPreviewPanel } from './migration-preview-panel'
import { UnmappedFieldsWarning, UnmappedFieldsBadge } from '../../unmapped/components/unmapped-fields-warning'
import type { TabBadgeData } from './field-mapping-view'

// ─── Object Mapping shape (from API) ─────────────────────────────────────────

interface ObjectMappingItem {
  id: string
  sourceObjectName: string
  destinationObjectName: string
  autoCreated: boolean
  fieldAutoMatchedAt: string | null
}

// ─── Single object mapping panel (config + preview side by side) ──────────────

interface FieldMappingPanelProps {
  planId: string
  mapping: ObjectMappingItem
  onChanged: () => void
}

function FieldMappingPanel({ planId, mapping, onChanged }: FieldMappingPanelProps) {
  const [unmappedVersion, setUnmappedVersion] = useState(0)

  const fm = useFieldMapping(planId, mapping.id)
  const unmapped = useUnmappedFields(planId, mapping.id, unmappedVersion)

  const handleChanged = () => {
    onChanged()
    setUnmappedVersion((v) => v + 1)
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Left: config section */}
      <section className="flex-1 min-w-0 rounded-lg border border-border p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold">
            {mapping.sourceObjectName} &rarr; {mapping.destinationObjectName}
          </h3>
          <div className="text-sm text-muted-foreground mt-1">
            {fm.fieldMappings.length} mappé{fm.fieldMappings.length !== 1 ? 's' : ''} ·{' '}
            {fm.unmappedSourceFields.length} non mappé{fm.unmappedSourceFields.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Unmapped fields warning — cluster 6 */}
        {!unmapped.loading && unmapped.report && (
          <div className="mb-6">
            <UnmappedFieldsWarning
              report={unmapped.report}
              onExcludeField={async (apiName) => {
                await unmapped.excludeField(apiName)
                handleChanged()
              }}
              onIncludeField={async (exclusionId) => {
                await unmapped.includeField(exclusionId)
                handleChanged()
              }}
            />
          </div>
        )}

        {fm.loading ? (
          <p className="text-sm text-muted-foreground">Chargement des champs…</p>
        ) : (
          <FieldMappingView
            planId={planId}
            objectMappingId={mapping.id}
            sourceObjectLabel={mapping.sourceObjectName}
            destObjectLabel={mapping.destinationObjectName}
            fieldMappings={fm.fieldMappings}
            filteredMappings={fm.filteredMappings}
            filteredUnmapped={fm.filteredUnmapped}
            availableDestFields={fm.availableDestFields}
            searchQuery={fm.searchQuery}
            selectedSourceFieldName={fm.selectedSourceFieldName}
            onSelectSource={fm.selectSourceField}
            onCreateLink={async (input) => {
              const r = await fm.createLink(input)
              if (!r.error) handleChanged()
              return r
            }}
            onDeleteLink={async (id) => {
              const r = await fm.deleteLink(id)
              if (!r.error) handleChanged()
              return r
            }}
            onAutoMatch={async () => {
              const r = await fm.triggerAutoMatch()
              handleChanged()
              return r
            }}
            onSearch={fm.setSearch}
            error={fm.error}
          />
        )}
      </section>

      {/* Right: preview sidebar — cluster 16 */}
      <aside className="w-96 shrink-0 sticky top-4 border border-border rounded-lg bg-background overflow-hidden max-h-[calc(100vh-8rem)]">
        <MigrationPreviewPanel
          planId={planId}
          objectMappingId={mapping.id}
          sourceObjectApiName={mapping.sourceObjectName}
          sourceObjectLabel={mapping.sourceObjectName}
          destObjectLabel={mapping.destinationObjectName}
          fieldMappings={fm.fieldMappings}
        />
      </aside>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FieldMappingPage({ planId }: { planId: string }) {
  const [mappings, setMappings] = useState<ObjectMappingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null)
  const [statsVersion, setStatsVersion] = useState(0)
  const [tabBadges, setTabBadges] = useState<Record<string, TabBadgeData>>({})

  useEffect(() => {
    fetch(`/api/plans/${planId}/object-mappings`)
      .then((res) => res.json())
      .then((data) => {
        const list: ObjectMappingItem[] = data.mappings ?? data ?? []
        setMappings(list)
        if (list.length > 0) setSelectedMappingId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  // Refresh tab badges when statsVersion changes
  useEffect(() => {
    if (mappings.length === 0) return
    const fetchBadges = async () => {
      const entries = await Promise.allSettled(
        mappings.map(async (m) => {
          const res = await fetch(`/api/plans/${planId}/object-mappings/${m.id}/field-mappings`)
          if (!res.ok) return null
          const data = await res.json()
          const fms = data.fieldMappings ?? []
          const unmapped = data.unmappedSourceFields ?? []
          const hasIncompatible = fms.some(
            (fm: { linkStatus: string }) =>
              fm.linkStatus === 'RED_SOLID' || fm.linkStatus === 'RED_DASHED' || fm.linkStatus === 'BROKEN',
          )
          return { id: m.id, data: { mapped: fms.length, total: fms.length + unmapped.length, hasIncompatible } }
        }),
      )
      const newBadges: Record<string, TabBadgeData> = {}
      for (const result of entries) {
        if (result.status === 'fulfilled' && result.value) {
          newBadges[result.value.id] = result.value.data
        }
      }
      setTabBadges(newBadges)
    }
    fetchBadges().catch(() => {})
  }, [planId, mappings, statsVersion])

  const selectedMapping = mappings.find((m) => m.id === selectedMappingId) ?? null
  const currentIndex = mappings.findIndex((m) => m.id === selectedMappingId)

  if (loading) return <div className="text-muted-foreground text-sm p-4">Chargement…</div>

  if (mappings.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground mb-2">Aucun mapping d&apos;objet trouvé.</p>
        <p className="text-sm text-muted-foreground">Configurez d&apos;abord les mappings d&apos;objets.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Object pair tabs with TabBadge (cluster 16) */}
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
            <span className="font-medium">{m.sourceObjectName}</span>
            <span className="text-muted-foreground">&rarr;</span>
            <span className="font-medium">{m.destinationObjectName}</span>
            <TabBadge data={tabBadges[m.id] ?? null} />
          </button>
        ))}
      </div>

      {/* Selected mapping panel */}
      {selectedMapping && (
        <FieldMappingPanel
          key={selectedMapping.id}
          planId={planId}
          mapping={selectedMapping}
          onChanged={() => setStatsVersion((v) => v + 1)}
        />
      )}

      {/* Navigate to next mapping */}
      {mappings.length > 1 && currentIndex < mappings.length - 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSelectedMappingId(mappings[currentIndex + 1].id)}
            className="text-sm border rounded px-3 py-1.5 bg-background hover:bg-muted transition-colors"
          >
            Objet suivant : {mappings[currentIndex + 1].sourceObjectName} &rarr; {mappings[currentIndex + 1].destinationObjectName} &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
