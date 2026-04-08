// Panneau de prévisualisation avant/après pour le field mapping
// Charge un enregistrement source, applique les mappings et équivalences de valeurs,
// et affiche le résultat côté destination.

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

    // Apply value equivalences (picklist mapping)
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
// Sub-components
// ---------------------------------------------------------------------------

function RecordColumn({
  label,
  fields,
  record,
  highlightChanged,
  referenceRecord,
}: {
  label: string
  fields: Array<{ apiName: string; fieldLabel: string }>
  record: ConnectorRecord
  highlightChanged?: boolean
  referenceRecord?: ConnectorRecord
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
        {label}
      </div>
      <div className="border rounded-lg overflow-hidden">
        {fields.map((field, i) => {
          const value = record[field.apiName]
          const refValue = referenceRecord?.[field.apiName]
          const changed = highlightChanged && refValue !== undefined && value !== refValue

          return (
            <div
              key={field.apiName}
              className={`flex items-start gap-2 px-3 py-2 text-sm ${
                i > 0 ? 'border-t border-border' : ''
              } ${changed ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
            >
              <span className="text-muted-foreground shrink-0 w-36 truncate text-xs pt-0.5">
                {field.fieldLabel}
              </span>
              <span className={`font-mono text-xs break-all ${changed ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                {formatValue(value)}
              </span>
            </div>
          )
        })}
        {fields.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            Aucun champ mappé.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MigrationPreviewPanel({
  planId,
  objectMappingId,
  sourceObjectApiName,
  destObjectLabel,
  fieldMappings,
}: MigrationPreviewPanelProps) {
  const [sourceRecord, setSourceRecord] = useState<ConnectorRecord | null>(null)
  const [logicMap, setLogicMap] = useState<Record<string, FieldMigrationLogic>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recordIndex, setRecordIndex] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)

  // Fetch 1 source record at current offset
  const fetchRecord = useCallback(
    async (index: number) => {
      setLoading(true)
      setError('')
      try {
        const url = `/api/plans/${planId}/records/${encodeURIComponent(sourceObjectApiName)}?role=source&page=${index + 1}&pageSize=1`
        const res = await fetch(url)
        const json = await res.json()
        if (!res.ok) throw new Error(json.message ?? 'Erreur lors du chargement.')
        const records: ConnectorRecord[] = json.records ?? []
        setTotalRecords(json.totalCount ?? 0)
        setSourceRecord(records[0] ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue.')
        setSourceRecord(null)
      } finally {
        setLoading(false)
      }
    },
    [planId, sourceObjectApiName],
  )

  // Fetch migration logic for all field mappings that have one
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

  useEffect(() => {
    fetchRecord(recordIndex)
  }, [fetchRecord, recordIndex])

  useEffect(() => {
    fetchLogic()
  }, [fetchLogic])

  const destRecord = sourceRecord
    ? applyMappings(sourceRecord, fieldMappings, logicMap)
    : null

  // Build field lists for display
  const sourceFields = fieldMappings.map((fm) => ({
    apiName: fm.sourceFieldApiName,
    fieldLabel: fm.sourceFieldLabel,
  }))

  const destFields = fieldMappings.map((fm) => ({
    apiName: fm.destFieldApiName,
    fieldLabel: fm.destFieldLabel,
  }))

  // Build source record restricted to mapped fields
  const mappedSourceRecord: ConnectorRecord = {}
  if (sourceRecord) {
    for (const fm of fieldMappings) {
      mappedSourceRecord[fm.sourceFieldApiName] = sourceRecord[fm.sourceFieldApiName]
    }
  }

  return (
    <div className="space-y-3">
      {/* Header + navigation */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Apercu de migration</h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {totalRecords > 0 && (
            <span className="text-xs">
              Enregistrement {recordIndex + 1} / {totalRecords}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRecordIndex((i) => Math.max(0, i - 1))}
            disabled={recordIndex === 0 || loading}
            className="px-2 py-0.5 border rounded text-xs disabled:opacity-40 hover:bg-muted transition-colors"
          >
            &larr;
          </button>
          <button
            type="button"
            onClick={() => setRecordIndex((i) => Math.min(totalRecords - 1, i + 1))}
            disabled={recordIndex >= totalRecords - 1 || loading}
            className="px-2 py-0.5 border rounded text-xs disabled:opacity-40 hover:bg-muted transition-colors"
          >
            &rarr;
          </button>
        </div>
      </div>

      {loading && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground animate-pulse">
          Chargement de l&apos;enregistrement...
        </div>
      )}

      {!loading && error && (
        <div className="border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !sourceRecord && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Aucun enregistrement source disponible.
        </div>
      )}

      {!loading && !error && sourceRecord && destRecord && (
        <div className="flex gap-4">
          <RecordColumn
            label="Source"
            fields={sourceFields}
            record={mappedSourceRecord}
          />

          <div className="flex items-center self-center text-muted-foreground/50 shrink-0">
            &rarr;
          </div>

          <RecordColumn
            label={destObjectLabel}
            fields={destFields}
            record={destRecord}
            highlightChanged
            referenceRecord={
              // Compare dest values to source values at same position for highlighting
              Object.fromEntries(
                fieldMappings.map((fm) => [
                  fm.destFieldApiName,
                  sourceRecord[fm.sourceFieldApiName],
                ])
              )
            }
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground/60">
        Apercu calculé localement — seules les équivalences de valeurs configurées sont appliquées.
      </p>
    </div>
  )
}
