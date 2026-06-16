// 012-field-mapping / Cluster 16 — FieldMappingView
// Table of mapped fields with linkStatus badge, search filter, and unmapped source section.
// Cluster 3: renders linkStatus colors/icons from enriched DTOs.

'use client'

import { useState, useCallback } from 'react'
import type { FieldMappingDTO, UnmappedSourceField, AvailableDestField, CreateFieldMappingInput } from '../types'

// ─── LinkStatus badge config ──────────────────────────────────────────────────

const LINK_STATUS_STYLES: Record<string, string> = {
  GREEN:      'bg-green-100 text-green-700 border-green-200',
  ORANGE:     'bg-amber-50 text-amber-700 border-amber-300',
  RED_SOLID:  'bg-red-100 text-red-700 border-red-200',
  RED_DASHED: 'bg-red-100 text-red-700 border-red-200 border-dashed',
  BROKEN:     'bg-red-200 text-red-900 border-red-500 font-semibold',
}

const LINK_STATUS_LABELS: Record<string, string> = {
  GREEN:      'Validé',
  ORANGE:     'En cours',
  RED_SOLID:  'À configurer',
  RED_DASHED: 'Incompatible',
  BROKEN:     'Cassé',
}

const LINK_STATUS_ICONS: Record<string, string> = {
  GREEN:      '✓',
  ORANGE:     '⚠',
  RED_SOLID:  '●',
  RED_DASHED: '✕',
  BROKEN:     '⚠',
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
      {type}
    </span>
  )
}

// ─── TabBadge (mapped/total counter) ─────────────────────────────────────────

export interface TabBadgeData {
  mapped: number
  total: number
  hasIncompatible: boolean
}

export function TabBadge({ data }: { data: TabBadgeData | null }) {
  if (!data) return null

  const color =
    data.hasIncompatible
      ? 'bg-red-100 text-red-700 border-red-200'
      : data.mapped === data.total && data.total > 0
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'bg-amber-100 text-amber-700 border-amber-200'

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${color}`}>
      {data.mapped}/{data.total}
    </span>
  )
}

// ─── FieldMappingView props ───────────────────────────────────────────────────

interface FieldMappingViewProps {
  planId: string
  objectMappingId: string
  sourceObjectLabel: string
  destObjectLabel: string
  fieldMappings: FieldMappingDTO[]
  filteredMappings: FieldMappingDTO[]
  filteredUnmapped: UnmappedSourceField[]
  availableDestFields: AvailableDestField[]
  searchQuery: string
  selectedSourceFieldName: string | null
  onSelectSource: (fieldName: string | null) => void
  onCreateLink: (input: CreateFieldMappingInput) => Promise<{ error?: string }>
  onDeleteLink: (fieldMappingId: string) => Promise<{ error?: string }>
  onAutoMatch: () => Promise<unknown>
  onSearch: (query: string) => void
  onMigrationLogicChanged?: () => void
  error?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FieldMappingView({
  sourceObjectLabel,
  destObjectLabel,
  fieldMappings,
  filteredMappings,
  filteredUnmapped,
  availableDestFields,
  searchQuery,
  selectedSourceFieldName,
  onSelectSource,
  onCreateLink,
  onDeleteLink,
  onAutoMatch,
  onSearch,
  error,
}: FieldMappingViewProps) {
  const [actionError, setActionError] = useState('')
  const [autoMatching, setAutoMatching] = useState(false)
  const [connectingFieldName, setConnectingFieldName] = useState<string | null>(null)

  // Destination fields not yet taken by any existing mapping
  const mappedDestNames = new Set(fieldMappings.map((m) => m.destinationFieldName))
  const unmappedDestFields = availableDestFields.filter((f) => !mappedDestNames.has(f.apiName))

  const handleAutoMatch = useCallback(async () => {
    setAutoMatching(true)
    setActionError('')
    await onAutoMatch()
    setAutoMatching(false)
  }, [onAutoMatch])

  const handleConnect = useCallback(
    async (srcFieldName: string, srcType: string, dstFieldName: string, dstType: string) => {
      setActionError('')
      const result = await onCreateLink({
        sourceFieldName: srcFieldName,
        destinationFieldName: dstFieldName,
        sourceFieldType: srcType,
        destFieldType: dstType,
      })
      if (result.error) {
        setActionError(result.error)
      }
      setConnectingFieldName(null)
      onSelectSource(null)
    },
    [onCreateLink, onSelectSource],
  )

  const handleDelete = useCallback(
    async (fieldMappingId: string) => {
      setActionError('')
      const result = await onDeleteLink(fieldMappingId)
      if (result.error) setActionError(result.error)
    },
    [onDeleteLink],
  )

  const displayError = error || actionError

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm text-muted-foreground">
            {fieldMappings.length} mappé{fieldMappings.length !== 1 ? 's' : ''}
          </span>
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Filtrer les champs..."
            className="text-sm border rounded px-2 py-1 bg-background flex-1 max-w-xs"
          />
        </div>
        <button
          type="button"
          onClick={handleAutoMatch}
          disabled={autoMatching}
          className="text-sm border rounded px-3 py-1.5 bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          {autoMatching ? 'Matching...' : 'Auto-match'}
        </button>
      </div>

      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}

      {/* Mapped fields table */}
      {filteredMappings.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-medium">{sourceObjectLabel}</th>
                <th className="text-center px-2 py-2 font-medium w-6"></th>
                <th className="text-left px-3 py-2 font-medium">{destObjectLabel}</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((m) => {
                const isBroken = m.linkStatus === 'BROKEN'
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-border ${
                      isBroken ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className={`px-3 py-2 ${isBroken ? 'opacity-70' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.sourceFieldLabel}</span>
                        <TypeBadge type={m.sourceFieldType} />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{m.sourceFieldName}</span>
                    </td>
                    <td className="text-center text-muted-foreground">&rarr;</td>
                    <td className={`px-3 py-2 ${isBroken ? 'opacity-70' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.destFieldLabel}</span>
                        <TypeBadge type={m.destFieldType} />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{m.destinationFieldName}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            LINK_STATUS_STYLES[m.linkStatus] ?? LINK_STATUS_STYLES.RED_SOLID
                          }`}
                          title={m.statusDetail}
                        >
                          <span>{LINK_STATUS_ICONS[m.linkStatus] ?? '●'}</span>
                          {LINK_STATUS_LABELS[m.linkStatus] ?? m.linkStatus}
                        </span>
                        {m.statusDetail && (
                          <span
                            className={`text-[10px] max-w-36 text-center leading-tight ${
                              isBroken ? 'text-red-700 dark:text-red-400' : 'text-amber-600'
                            }`}
                          >
                            {m.statusDetail}
                          </span>
                        )}
                        {isBroken && (
                          <span className="text-[10px] text-red-700 dark:text-red-400 max-w-36 text-center leading-tight italic">
                            Supprimez puis recréez ce mapping.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="text-xs text-muted-foreground hover:text-destructive px-1"
                        title="Supprimer le mapping"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unmapped source fields — connect to a destination field */}
      {filteredUnmapped.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Champs source non mappés ({filteredUnmapped.length})
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {filteredUnmapped.map((sf) => (
                  <tr key={sf.apiName} className="border-t first:border-t-0 border-border hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sf.label}</span>
                        <TypeBadge type={sf.dataType} />
                        {sf.isRequired && (
                          <span className="text-xs text-destructive">required</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{sf.apiName}</span>
                    </td>
                    <td className="px-3 py-2 text-right w-52">
                      {connectingFieldName === sf.apiName ? (
                        <select
                          className="text-xs border rounded px-2 py-1 w-full bg-background"
                          defaultValue=""
                          onChange={(e) => {
                            const destField = unmappedDestFields.find((d) => d.apiName === e.target.value)
                            if (destField) {
                              handleConnect(sf.apiName, sf.dataType, destField.apiName, destField.dataType)
                            }
                          }}
                          onBlur={() => setConnectingFieldName(null)}
                          autoFocus
                        >
                          <option value="" disabled>Choisir la destination…</option>
                          {unmappedDestFields.map((df) => (
                            <option key={df.apiName} value={df.apiName}>
                              {df.label} ({df.dataType})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConnectingFieldName(sf.apiName)}
                          className="text-xs text-primary hover:underline"
                        >
                          Mapper vers…
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fieldMappings.length === 0 && filteredUnmapped.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          Aucun champ disponible. Vérifiez que les schémas source et destination ont été récupérés.
        </div>
      )}
    </div>
  )
}
