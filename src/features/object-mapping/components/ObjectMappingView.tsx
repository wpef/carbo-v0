// 011-object-mapping — T013: A1 two-column view with SVG overlay for object links
// Session learnings baked in:
//   #1 — stroke="var(--primary)" (in ObjectLink) NOT hsl(var(--primary))
//   #2 — useLayoutEffect deps are primitive values, single setSvgLayout call (in useSvgLinks)
//   #3 — SVG overlays the FULL container, coordinates from actual bounding rects

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { recordStep } from '@/features/plans/lib/record-step'
import { ObjectCard } from './ObjectCard'
import { ObjectLink } from './ObjectLink'
import { ObjectSearchFilter, type ObjectFilterCategory } from './ObjectSearchFilter'
import { ObjectDetailModal } from './ObjectDetailModal'
import { useSvgLinks } from '../hooks/useSvgLinks'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import type { SchemaObjectItem, ObjectMappingItem } from '../hooks/useObjectMappings'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObjectMappingViewProps {
  planId: string
  sourceObjects: SchemaObjectItem[]
  destObjects: SchemaObjectItem[]
  mappings: ObjectMappingItem[]
  loading?: boolean
  error?: string
  onCreateMapping: (sourceObjectName: string, destinationObjectName: string) => Promise<{ error?: string; warning?: string }>
  onDeleteMapping: (mappingId: string) => Promise<{ error?: string }>
}

// ─── Detail state ─────────────────────────────────────────────────────────────

interface DetailState {
  apiName: string
  label: string
  role: 'source' | 'destination'
  /** mappingId to look up stats, null for unmapped objects */
  mappingId: string | null
}

// ─── Delete confirm state ─────────────────────────────────────────────────────

interface DeleteConfirm {
  mappingId: string
  sourceObjectName: string
  destinationObjectName: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ObjectMappingView({
  planId,
  sourceObjects,
  destObjects,
  mappings,
  loading = false,
  error,
  onCreateMapping,
  onDeleteMapping,
}: ObjectMappingViewProps) {
  const router = useRouter()

  // ─── Search + filter state (per column) ────────────────────────────────────
  const [sourceSearch, setSourceSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<ObjectFilterCategory>('all')
  const [destFilter, setDestFilter] = useState<ObjectFilterCategory>('all')

  // ─── Link state machine ─────────────────────────────────────────────────────
  // selectedSourceApiName: non-null = waiting for dest click
  const [selectedSourceApiName, setSelectedSourceApiName] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionWarning, setActionWarning] = useState('')

  // ─── Delete confirm dialog ──────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Detail modal ───────────────────────────────────────────────────────────
  const [detailState, setDetailState] = useState<DetailState | null>(null)

  // ─── Derived sets ───────────────────────────────────────────────────────────
  const mappedSourceNames = new Set(mappings.map((m) => m.sourceObjectName))
  const mappedDestNames = new Set(mappings.map((m) => m.destinationObjectName))

  // ─── Filtered object lists ──────────────────────────────────────────────────
  const filteredSourceObjects = sourceObjects.filter((o) => {
    const term = sourceSearch.toLowerCase()
    const matchesSearch = !term
      || o.label.toLowerCase().includes(term)
      || o.apiName.toLowerCase().includes(term)
    if (!matchesSearch) return false
    if (sourceFilter === 'mapped') return mappedSourceNames.has(o.apiName)
    if (sourceFilter === 'unmapped') return !mappedSourceNames.has(o.apiName)
    if (sourceFilter === 'standard') return !o.isCustom
    if (sourceFilter === 'custom') return o.isCustom
    return true
  })

  const filteredDestObjects = destObjects.filter((o) => {
    const term = destSearch.toLowerCase()
    const matchesSearch = !term
      || o.label.toLowerCase().includes(term)
      || o.apiName.toLowerCase().includes(term)
    if (!matchesSearch) return false
    if (destFilter === 'mapped') return mappedDestNames.has(o.apiName)
    if (destFilter === 'unmapped') return !mappedDestNames.has(o.apiName)
    if (destFilter === 'standard') return !o.isCustom
    if (destFilter === 'custom') return o.isCustom
    return true
  })

  // ─── SVG layout (session learning #2: primitive deps only) ──────────────────
  const { sourceColRef, destColRef, svgContainerRef, svgLayout } = useSvgLinks([
    sourceSearch,
    destSearch,
    sourceFilter,
    destFilter,
    mappings.length,
    filteredSourceObjects.length,
    filteredDestObjects.length,
  ])

  // Build SVG link data — match by apiName (stable across snapshot refreshes)
  const svgLinks = mappings.flatMap((m) => {
    const srcPos = svgLayout.sourcePositions.find((p) => p.apiName === m.sourceObjectName)
    const dstPos = svgLayout.destPositions.find((p) => p.apiName === m.destinationObjectName)
    if (!srcPos || !dstPos) return []
    return [{ mappingId: m.id, x1: srcPos.x, y1: srcPos.centerY, x2: dstPos.x, y2: dstPos.centerY }]
  })

  // ─── Event handlers ─────────────────────────────────────────────────────────

  const handleSourceCircleClick = useCallback((apiName: string) => {
    setActionError('')
    setActionWarning('')
    setSelectedSourceApiName((prev) => (prev === apiName ? null : apiName))
  }, [])

  const handleDestCircleClick = useCallback(
    async (destApiName: string) => {
      if (!selectedSourceApiName) return
      setActionError('')
      setActionWarning('')
      const result = await onCreateMapping(selectedSourceApiName, destApiName)
      if (result.error) {
        setActionError(result.error)
      } else {
        setSelectedSourceApiName(null)
        if (result.warning) setActionWarning(result.warning)
      }
    },
    [selectedSourceApiName, onCreateMapping],
  )

  const handleDeleteRequest = useCallback(
    (mappingId: string) => {
      const m = mappings.find((x) => x.id === mappingId)
      if (!m) return
      setDeleteConfirm({
        mappingId,
        sourceObjectName: m.sourceObjectName,
        destinationObjectName: m.destinationObjectName,
      })
    },
    [mappings],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const result = await onDeleteMapping(deleteConfirm.mappingId)
    setDeleting(false)
    if (result.error) {
      setActionError(result.error)
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, onDeleteMapping])

  const handleSourceCardClick = useCallback(
    (apiName: string) => {
      const obj = sourceObjects.find((o) => o.apiName === apiName)
      if (!obj) return
      const mapping = mappings.find((m) => m.sourceObjectName === apiName) ?? null
      setDetailState({ apiName, label: obj.label, role: 'source', mappingId: mapping?.id ?? null })
    },
    [sourceObjects, mappings],
  )

  const handleDestCardClick = useCallback(
    (apiName: string) => {
      const obj = destObjects.find((o) => o.apiName === apiName)
      if (!obj) return
      const mapping = mappings.find((m) => m.destinationObjectName === apiName) ?? null
      setDetailState({ apiName, label: obj.label, role: 'destination', mappingId: mapping?.id ?? null })
    },
    [destObjects, mappings],
  )

  const handleNavigateToFieldMapping = useCallback(async () => {
    const apiName = detailState?.apiName
    setDetailState(null)
    await recordStep(planId, 'FIELD_MAPPING')
    router.push(`/plans/${planId}/field-mapping${apiName ? `?object=${apiName}` : ''}`)
  }, [router, planId, detailState])

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid grid-cols-[1fr_80px_1fr] gap-0 animate-pulse">
        {[0, 2].map((col) => (
          <div key={col} className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg border border-border bg-muted/30" />
            ))}
          </div>
        ))}
        <div />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{mappings.length} mapping{mappings.length !== 1 ? 's' : ''}</span>
        {selectedSourceApiName && (
          <span className="text-primary bg-primary/5 border border-primary/20 rounded px-2 py-0.5 text-xs">
            Source sélectionnée : <strong>{selectedSourceApiName}</strong> — Cliquez un cercle destination.{' '}
            <button
              type="button"
              className="underline hover:no-underline"
              onClick={() => { setSelectedSourceApiName(null); setActionError('') }}
            >
              Annuler
            </button>
          </span>
        )}
      </div>

      {/* Errors & warnings */}
      {(error || actionError) && (
        <p className="text-sm text-destructive" role="alert">{error ?? actionError}</p>
      )}
      {actionWarning && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2" role="status">
          {actionWarning}
        </p>
      )}

      {/* Two-column layout + SVG overlay (session learning #3: SVG on full container) */}
      <div className="relative" ref={svgContainerRef}>
        {/* SVG spans the entire container */}
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{
            width: svgLayout.width > 0 ? svgLayout.width : '100%',
            height: svgLayout.height > 0 ? svgLayout.height : '100%',
          }}
        >
          {svgLinks.map((link) => (
            <ObjectLink
              key={link.mappingId}
              x1={link.x1}
              y1={link.y1}
              x2={link.x2}
              y2={link.y2}
              mappingId={link.mappingId}
              onDelete={handleDeleteRequest}
            />
          ))}
        </svg>

        <div className="grid grid-cols-[1fr_80px_1fr] gap-0">
          {/* ── Source column ── */}
          <div className="space-y-2 pr-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Source
              <span className="ml-2 font-normal normal-case text-muted-foreground/70">
                ({filteredSourceObjects.length})
              </span>
            </h3>
            <ObjectSearchFilter
              search={sourceSearch}
              onSearchChange={setSourceSearch}
              filter={sourceFilter}
              onFilterChange={setSourceFilter}
              placeholder="Filtrer les objets source..."
            />
            <div className="space-y-1 mt-1" ref={sourceColRef}>
              {filteredSourceObjects.map((obj) => (
                <div key={obj.apiName} data-api-name={obj.apiName}>
                  <ObjectCard
                    apiName={obj.apiName}
                    label={obj.label}
                    isCustom={obj.isCustom}
                    role="source"
                    isHighlighted={selectedSourceApiName === obj.apiName}
                    isMapped={mappedSourceNames.has(obj.apiName)}
                    onCircleClick={handleSourceCircleClick}
                    onCardClick={handleSourceCardClick}
                  />
                </div>
              ))}
              {filteredSourceObjects.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Aucun objet ne correspond.
                </p>
              )}
            </div>
          </div>

          {/* ── Bridge spacer ── */}
          <div />

          {/* ── Destination column ── */}
          <div className="space-y-2 pl-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Destination
              <span className="ml-2 font-normal normal-case text-muted-foreground/70">
                ({filteredDestObjects.length})
              </span>
            </h3>
            <ObjectSearchFilter
              search={destSearch}
              onSearchChange={setDestSearch}
              filter={destFilter}
              onFilterChange={setDestFilter}
              placeholder="Filtrer les objets destination..."
            />
            <div className="space-y-1 mt-1" ref={destColRef}>
              {filteredDestObjects.map((obj) => (
                <div key={obj.apiName} data-api-name={obj.apiName}>
                  <ObjectCard
                    apiName={obj.apiName}
                    label={obj.label}
                    isCustom={obj.isCustom}
                    role="destination"
                    isMapped={mappedDestNames.has(obj.apiName)}
                    onCircleClick={
                      selectedSourceApiName ? handleDestCircleClick : undefined
                    }
                    onCardClick={handleDestCardClick}
                  />
                </div>
              ))}
              {filteredDestObjects.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Aucun objet ne correspond.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Field-mapping link per mapping row (spec FR-013: "Map fields" link) */}
      {mappings.length > 0 && (
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Mappings ({mappings.length})
          </h4>
          <div className="space-y-1">
            {mappings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-1.5 rounded border border-border bg-muted/10 text-sm"
              >
                <span>
                  <span className="font-mono text-xs">{m.sourceObjectName}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="font-mono text-xs">{m.destinationObjectName}</span>
                </span>
                <a
                  href={`/plans/${planId}/field-mapping?object=${m.sourceObjectName}`}
                  className="text-xs text-primary hover:underline shrink-0 ml-4"
                >
                  Mapper les champs →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirm dialog (spec FR-010, FR-011) */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mapping ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression de{' '}
              <strong>{deleteConfirm?.sourceObjectName} → {deleteConfirm?.destinationObjectName}</strong>{' '}
              effacera en cascade tous les mappings de champs, règles de migration et filtres associés.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail modal (spec FR-008, FR-009) */}
      {detailState && (
        <ObjectDetailModal
          open={true}
          onClose={() => setDetailState(null)}
          objectApiName={detailState.apiName}
          objectLabel={detailState.label}
          role={detailState.role}
          recordCount={null}
          fieldsToValidate={0}
          totalFields={0}
          migrationFilterCount={0}
          onNavigateToFieldMapping={handleNavigateToFieldMapping}
        />
      )}
    </div>
  )
}
