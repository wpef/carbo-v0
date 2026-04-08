// Sidebar de prévisualisation avant/après pour le field mapping
// Affiche source et destination côte à côte avec sélecteur d'enregistrement.

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FieldMappingDTO } from '@/lib/types/field-mapping'
import type { ConnectorRecord } from '@/lib/connectors/types'

interface ValueEquivalence {
  sourceValue: string
  destinationValue: string
}

interface FieldMigrationLogic {
  fieldMappingId: string
  sectionType: string
  valueEquivalences: ValueEquivalence[]
}

interface MigrationPreviewPanelProps {
  planId: string
  objectMappingId: string
  sourceObjectApiName: string
  sourceObjectLabel: string
  destObjectLabel: string
  fieldMappings: FieldMappingDTO[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'vrai' : 'faux'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function recordLabel(record: ConnectorRecord, index: number): string {
  const textValues = Object.values(record)
    .filter((v) => typeof v === 'string' && v.length > 0 && v.length < 60)
    .slice(0, 3)
  if (textValues.length > 0) return textValues.join(' · ')
  return `Ligne ${index + 1}`
}

function applyMappings(
  sourceRecord: ConnectorRecord,
  fieldMappings: FieldMappingDTO[],
  logicByFieldMappingId: Record<string, FieldMigrationLogic>,
): ConnectorRecord {
  const result: ConnectorRecord = {}

  for (const mapping of fieldMappings) {
    const rawValue = sourceRecord[mapping.sourceFieldApiName]
    const logic = logicByFieldMappingId[mapping.id]

    let transformedValue: unknown = rawValue

    if (logic && logic.sectionType === 'VALUE_EQUIVALENCE' && logic.valueEquivalences.length > 0) {
      const strValue = rawValue !== null && rawValue !== undefined ? String(rawValue) : null
      const match = strValue !== null
        ? logic.valueEquivalences.find((ve) => ve.sourceValue === strValue)
        : null
      transformedValue = match ? match.destinationValue : rawValue
    }

    result[mapping.destFieldApiName] = transformedValue
  }

  return result
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MigrationPreviewPanel({
  planId,
  objectMappingId,
  sourceObjectApiName,
  sourceObjectLabel,
  destObjectLabel,
  fieldMappings,
}: MigrationPreviewPanelProps) {
  const [records, setRecords] = useState<ConnectorRecord[]>([])
  const [logicMap, setLogicMap] = useState<Record<string, FieldMigrationLogic>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Fetch a batch of source records
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = `/api/plans/${planId}/records/${encodeURIComponent(sourceObjectApiName)}?role=source&page=1&pageSize=25`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Erreur lors du chargement.')
      setRecords(json.records ?? [])
      setSelectedIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [planId, sourceObjectApiName])

  // Fetch migration logic for all field mappings
  const fetchLogic = useCallback(async () => {
    if (fieldMappings.length === 0) return

    const results = await Promise.allSettled(
      fieldMappings.map(async (fm) => {
        const url = `/api/plans/${planId}/object-mappings/${objectMappingId}/fields/${fm.id}/migration-logic`
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (!data.migrationLogic) return null
        return { fieldMappingId: fm.id, logic: data.migrationLogic as FieldMigrationLogic }
      }),
    )

    const map: Record<string, FieldMigrationLogic> = {}
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        map[r.value.fieldMappingId] = r.value.logic
      }
    }
    setLogicMap(map)
  }, [planId, objectMappingId, fieldMappings])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchLogic() }, [fetchLogic])

  const sourceRecord = records[selectedIndex] ?? null
  const destRecord = sourceRecord ? applyMappings(sourceRecord, fieldMappings, logicMap) : null

  if (fieldMappings.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          Mappez des champs pour voir l&apos;aperçu de migration.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Aperçu de migration
        </h4>
      </div>

      {/* Record selector */}
      <div className="px-3 py-2 border-b border-border bg-background shrink-0">
        <label className="text-[11px] text-muted-foreground block mb-1">
          Enregistrement source
        </label>
        {loading ? (
          <div className="text-xs text-muted-foreground animate-pulse py-1">Chargement…</div>
        ) : error ? (
          <div className="text-xs text-destructive py-1">{error}</div>
        ) : records.length === 0 ? (
          <div className="text-xs text-muted-foreground py-1">Aucun enregistrement disponible.</div>
        ) : (
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {records.map((rec, i) => (
              <option key={i} value={i}>
                {recordLabel(rec, i)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Side-by-side: Source | Destination */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sourceRecord && destRecord && (
          <div className="flex divide-x divide-border">
            {/* Source column */}
            <div className="flex-1 min-w-0">
              <div className="px-2 py-1.5 bg-muted/20 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sourceObjectLabel}
                </span>
              </div>
              {fieldMappings.map((fm, i) => (
                <div
                  key={fm.id}
                  className={`px-2 py-1.5 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="text-[10px] text-muted-foreground truncate">{fm.sourceFieldLabel}</div>
                  <div className="text-xs font-mono truncate">{formatValue(sourceRecord[fm.sourceFieldApiName])}</div>
                </div>
              ))}
            </div>

            {/* Destination column */}
            <div className="flex-1 min-w-0">
              <div className="px-2 py-1.5 bg-muted/20 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {destObjectLabel}
                </span>
              </div>
              {fieldMappings.map((fm, i) => {
                const srcVal = sourceRecord[fm.sourceFieldApiName]
                const dstVal = destRecord[fm.destFieldApiName]
                const changed = String(srcVal ?? '') !== String(dstVal ?? '')
                return (
                  <div
                    key={fm.id}
                    className={`px-2 py-1.5 ${i > 0 ? 'border-t border-border' : ''} ${changed ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                  >
                    <div className="text-[10px] text-muted-foreground truncate">{fm.destFieldLabel}</div>
                    <div className={`text-xs font-mono truncate ${changed ? 'text-amber-700 dark:text-amber-400 font-semibold' : ''}`}>
                      {formatValue(dstVal)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border shrink-0">
        <p className="text-[10px] text-muted-foreground/60">
          Aperçu local — seules les équivalences de valeurs sont appliquées.
        </p>
      </div>
    </div>
  )
}
