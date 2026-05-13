// 012-field-mapping — Table-based field mapping view (replaces SVG approach)
// 013-migration-logic — Integrated migration logic modal

'use client'

import { useState, useCallback } from 'react'
import { MigrationLogicModal } from './MigrationLogicModal'
import { Button } from '@/components/ui/button'
import { FieldLinkState } from '@/lib/types/field-mapping'
import { useMigrationLogic } from '@/hooks/use-migration-logic'
import type {
  FieldMappingDTO,
  UnmappedSourceField,
  AvailableDestField,
  CreateFieldMappingInput,
} from '@/lib/types/field-mapping'
import type { SectionType, SaveMigrationLogicInput } from '@/lib/types/mapping'

interface FieldMappingViewProps {
  planId: string
  objectMappingId: string
  sourceObjectLabel: string
  destObjectLabel: string
  fieldMappings: FieldMappingDTO[]
  unmappedSourceFields: UnmappedSourceField[]
  availableDestFields: AvailableDestField[]
  linkState: FieldLinkState
  selectedSourceFieldId: string | null
  onSelectSource: (fieldId: string | null) => void
  onCreateLink: (input: CreateFieldMappingInput) => Promise<{ error?: string }>
  onDeleteLink: (fieldMappingId: string) => Promise<{ error?: string }>
  onAutoMatch: () => Promise<unknown>
  onMigrationLogicChanged?: () => void
  error?: string
}

// ---------------------------------------------------------------------------
// Compatibility badge
// ---------------------------------------------------------------------------

const LINK_STATUS_STYLES: Record<string, string> = {
  GREEN: 'bg-green-100 text-green-700 border-green-200',
  GREEN_PARTIAL: 'bg-amber-50 text-amber-700 border-amber-300',
  RED_SOLID: 'bg-red-100 text-red-700 border-red-200',
  RED_DASHED: 'bg-red-100 text-red-700 border-red-200 border-dashed',
  BROKEN: 'bg-red-200 text-red-900 border-red-500 font-semibold',
}

const LINK_STATUS_LABELS: Record<string, string> = {
  GREEN: 'Validé',
  GREEN_PARTIAL: 'Validé (partiel)',
  RED_SOLID: 'À configurer',
  RED_DASHED: 'Incompatible',
  BROKEN: 'Cassé',
}

const LINK_STATUS_ICONS: Record<string, string> = {
  GREEN: '✓',
  GREEN_PARTIAL: '⚠',
  RED_SOLID: '●',
  RED_DASHED: '✕',
  BROKEN: '⚠',
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FieldMappingView({
  planId,
  objectMappingId,
  sourceObjectLabel,
  destObjectLabel,
  fieldMappings,
  unmappedSourceFields,
  availableDestFields,
  linkState,
  selectedSourceFieldId,
  onSelectSource,
  onCreateLink,
  onDeleteLink,
  onAutoMatch,
  onMigrationLogicChanged,
  error,
}: FieldMappingViewProps) {
  const [actionError, setActionError] = useState('')
  const [autoMatching, setAutoMatching] = useState(false)
  const [connectingFieldId, setConnectingFieldId] = useState<string | null>(null)
  const [fieldSearch, setFieldSearch] = useState('')

  // Migration logic modal state
  const migrationLogic = useMigrationLogic()
  const [activeMappingMeta, setActiveMappingMeta] = useState<{
    sourceFieldLabel: string
    sourceFieldType: string
    destFieldLabel: string
    destFieldType: string
  } | null>(null)

  // Track which destination fields are already taken by apiName, not by FK id
  // (FK goes stale after snapshot rotation — 017 Design Decisions).
  const mappedDestApiNames = new Set(fieldMappings.map((m) => m.destFieldApiName))

  // Available dest fields not yet mapped
  const unmappedDestFields = availableDestFields.filter((f) => !mappedDestApiNames.has(f.apiName))

  const lowerSearch = fieldSearch.toLowerCase()
  const filteredMappings = fieldSearch
    ? fieldMappings.filter(
        (m) =>
          m.sourceFieldLabel.toLowerCase().includes(lowerSearch) ||
          m.sourceFieldApiName.toLowerCase().includes(lowerSearch) ||
          m.destFieldLabel.toLowerCase().includes(lowerSearch) ||
          m.destFieldApiName.toLowerCase().includes(lowerSearch),
      )
    : fieldMappings

  const filteredUnmappedSourceFields = fieldSearch
    ? unmappedSourceFields.filter(
        (sf) =>
          sf.label.toLowerCase().includes(lowerSearch) ||
          sf.apiName.toLowerCase().includes(lowerSearch),
      )
    : unmappedSourceFields

  const handleAutoMatch = useCallback(async () => {
    setAutoMatching(true)
    setActionError('')
    await onAutoMatch()
    setAutoMatching(false)
  }, [onAutoMatch])

  const handleConnect = useCallback(
    async (sourceFieldId: string, sourceApiName: string, destFieldId: string, destApiName: string) => {
      setActionError('')
      const result = await onCreateLink({
        sourceFieldId,
        sourceFieldApiName: sourceApiName,
        destFieldId,
        destFieldApiName: destApiName,
      })
      if (result.error) {
        setActionError(result.error)
      }
      setConnectingFieldId(null)
    },
    [onCreateLink],
  )

  const handleDelete = useCallback(
    async (fieldMappingId: string) => {
      setActionError('')
      const result = await onDeleteLink(fieldMappingId)
      if (result.error) {
        setActionError(result.error)
      }
    },
    [onDeleteLink],
  )

  const handleOpenMigrationLogic = useCallback(
    async (fieldMappingId: string) => {
      const mapping = fieldMappings.find((m) => m.id === fieldMappingId)
      if (!mapping) return

      setActiveMappingMeta({
        sourceFieldLabel: mapping.sourceFieldLabel,
        sourceFieldType: mapping.sourceFieldType,
        destFieldLabel: mapping.destFieldLabel,
        destFieldType: mapping.destFieldType,
      })

      await migrationLogic.openModal({
        fieldMappingId,
        planId,
        objectMappingId,
        mappingId: objectMappingId,
      })
    },
    [fieldMappings, planId, objectMappingId, migrationLogic],
  )

  const handleMigrationLogicSave = useCallback(
    async (input: { sectionType: SectionType; valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>; promptText?: string }) => {
      const result = await migrationLogic.saveMigrationLogic(input as SaveMigrationLogicInput, 'DEFINED')
      if (!result.error) onMigrationLogicChanged?.()
      return result
    },
    [migrationLogic, onMigrationLogicChanged],
  )

  const handleMigrationLogicValidate = useCallback(
    async (input: { sectionType: SectionType; valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>; promptText?: string }) => {
      const result = await migrationLogic.saveMigrationLogic(input as SaveMigrationLogicInput, 'VALIDATED')
      if (!result.error) onMigrationLogicChanged?.()
      return result
    },
    [migrationLogic, onMigrationLogicChanged],
  )

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {fieldMappings.length} mapped
          </span>
          {unmappedSourceFields.length > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              {unmappedSourceFields.length} unmapped
            </span>
          )}
          <input
            type="text"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            placeholder="Filtrer les champs..."
            className="text-sm border rounded px-2 py-1 bg-background flex-1 max-w-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={autoMatching}>
          {autoMatching ? 'Matching...' : 'Auto-match'}
        </Button>
      </div>

      {(error || actionError) && <p className="text-sm text-destructive">{error || actionError}</p>}

      {/* Mapped fields table */}
      {filteredMappings.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-medium">{sourceObjectLabel}</th>
                <th className="text-center px-2 py-2 font-medium w-8"></th>
                <th className="text-left px-3 py-2 font-medium">{destObjectLabel}</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium w-24">Actions</th>
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
                      <span className="text-xs text-muted-foreground font-mono">{m.sourceFieldApiName}</span>
                    </td>
                    <td className="text-center text-muted-foreground">&rarr;</td>
                    <td className={`px-3 py-2 ${isBroken ? 'opacity-70' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.destFieldLabel}</span>
                        <TypeBadge type={m.destFieldType} />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{m.destFieldApiName}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${LINK_STATUS_STYLES[m.linkStatus] ?? LINK_STATUS_STYLES.RED_SOLID}`}
                          title={m.statusDetail ?? undefined}
                        >
                          <span>{LINK_STATUS_ICONS[m.linkStatus] ?? '●'}</span>
                          {LINK_STATUS_LABELS[m.linkStatus] ?? m.linkStatus}
                        </span>
                        {m.statusDetail && (
                          <span
                            className={`text-[10px] max-w-35 text-center leading-tight ${
                              isBroken ? 'text-red-700 dark:text-red-400' : 'text-amber-600'
                            }`}
                          >
                            {m.statusDetail}
                          </span>
                        )}
                        {isBroken && (
                          <span className="text-[10px] text-red-700 dark:text-red-400 max-w-35 text-center leading-tight italic">
                            Supprimez puis recréez ce mapping.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isBroken ? (
                          <button
                            type="button"
                            onClick={() => handleOpenMigrationLogic(m.id)}
                            className="text-xs text-primary hover:underline px-1"
                            title="Configure transformation"
                          >
                            Configure
                          </button>
                        ) : (
                          <span
                            className="text-xs text-muted-foreground/50 px-1 cursor-not-allowed"
                            title="Mapping cassé — supprimez et recréez pour pouvoir configurer"
                          >
                            Configure
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="text-xs text-muted-foreground hover:text-destructive px-1"
                          title="Remove mapping"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unmapped source fields */}
      {filteredUnmappedSourceFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Unmapped Source Fields
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {filteredUnmappedSourceFields.map((sf) => (
                  <tr key={sf.id} className="border-t first:border-t-0 border-border hover:bg-muted/20">
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
                    <td className="px-3 py-2 text-right w-48">
                      {connectingFieldId === sf.id ? (
                        <select
                          className="text-xs border rounded px-2 py-1 w-full bg-background"
                          defaultValue=""
                          onChange={(e) => {
                            const destField = unmappedDestFields.find((d) => d.id === e.target.value)
                            if (destField) {
                              handleConnect(sf.id, sf.apiName, destField.id, destField.apiName)
                            }
                          }}
                          onBlur={() => setConnectingFieldId(null)}
                          autoFocus
                        >
                          <option value="" disabled>Select destination...</option>
                          {unmappedDestFields.map((df) => (
                            <option key={df.id} value={df.id}>
                              {df.label} ({df.dataType})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConnectingFieldId(sf.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          Map to...
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

      {fieldMappings.length === 0 && unmappedSourceFields.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No fields available. Check that source and destination schemas are retrieved.
        </div>
      )}

      {/* Migration Logic Modal */}
      {activeMappingMeta && migrationLogic.suggestedSection && (
        <MigrationLogicModal
          open={migrationLogic.open}
          onClose={migrationLogic.closeModal}
          sourceFieldLabel={activeMappingMeta.sourceFieldLabel}
          sourceFieldType={activeMappingMeta.sourceFieldType}
          destFieldLabel={activeMappingMeta.destFieldLabel}
          destFieldType={activeMappingMeta.destFieldType}
          sectionType={migrationLogic.suggestedSection}
          informationalMessage={migrationLogic.informationalMessage}
          migrationLogic={migrationLogic.migrationLogic}
          sourcePicklistValues={migrationLogic.sourcePicklistValues}
          destPicklistValues={migrationLogic.destPicklistValues}
          sampleSourceValues={migrationLogic.sampleSourceValues}
          loading={migrationLogic.loading}
          saving={migrationLogic.saving}
          error={migrationLogic.error}
          onSave={handleMigrationLogicSave}
          onValidate={handleMigrationLogicValidate}
          onClassify={migrationLogic.classifySamples}
        />
      )}
    </div>
  )
}
