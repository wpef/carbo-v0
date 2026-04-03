// 012-field-mapping — Two-column field mapping view with SVG overlay for links
// 013-migration-logic — Extended with migration logic modal integration

'use client'

import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { FieldCard } from './FieldCard'
import { FieldLink } from './FieldLink'
import { FieldSearchFilter } from './FieldSearchFilter'
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
  error?: string
}

interface CardPosition {
  fieldId: string
  centerY: number
}

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
  error,
}: FieldMappingViewProps) {
  const [sourceSearch, setSourceSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [actionError, setActionError] = useState('')
  const [autoMatching, setAutoMatching] = useState(false)

  // Migration logic modal state
  const migrationLogic = useMigrationLogic()
  const [activeMappingMeta, setActiveMappingMeta] = useState<{
    sourceFieldLabel: string
    sourceFieldType: string
    destFieldLabel: string
    destFieldType: string
    sourcePicklistValues: string[]
    destPicklistValues: string[]
    sampleSourceValues: string[]
  } | null>(null)

  const sourceColRef = useRef<HTMLDivElement>(null)
  const destColRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const [sourcePositions, setSourcePositions] = useState<CardPosition[]>([])
  const [destPositions, setDestPositions] = useState<CardPosition[]>([])
  const [svgWidth, setSvgWidth] = useState(0)
  const [svgHeight, setSvgHeight] = useState(0)

  // Build full source and dest field lists
  const mappedSourceIds = new Set(fieldMappings.map((m) => m.sourceFieldId))
  const mappedDestIds = new Set(fieldMappings.map((m) => m.destFieldId))

  const allSourceFields = [
    ...fieldMappings.map((m) => ({
      id: m.sourceFieldId,
      apiName: m.sourceFieldApiName,
      label: m.sourceFieldLabel,
      dataType: m.sourceFieldType,
      isRequired: false,
      isMapped: true,
    })),
    ...unmappedSourceFields.map((f) => ({
      id: f.id,
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      isMapped: false,
    })),
  ]

  const filteredSourceFields = allSourceFields.filter(
    (f) =>
      f.label.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      f.apiName.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      f.dataType.toLowerCase().includes(sourceSearch.toLowerCase()),
  )

  const filteredDestFields = availableDestFields.filter(
    (f) =>
      f.label.toLowerCase().includes(destSearch.toLowerCase()) ||
      f.apiName.toLowerCase().includes(destSearch.toLowerCase()) ||
      f.dataType.toLowerCase().includes(destSearch.toLowerCase()),
  )

  // Update card positions for SVG links
  const updatePositions = useCallback(() => {
    if (!sourceColRef.current || !destColRef.current || !svgContainerRef.current) return

    const svgRect = svgContainerRef.current.getBoundingClientRect()
    setSvgWidth(svgRect.width)
    setSvgHeight(Math.max(svgRect.height, 200))

    const sourceCards = sourceColRef.current.querySelectorAll('[data-field-id]')
    const destCards = destColRef.current.querySelectorAll('[data-field-id]')

    const newSourcePositions: CardPosition[] = []
    const newDestPositions: CardPosition[] = []

    sourceCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const fieldId = card.getAttribute('data-field-id') ?? ''
      newSourcePositions.push({ fieldId, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    destCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const fieldId = card.getAttribute('data-field-id') ?? ''
      newDestPositions.push({ fieldId, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    setSourcePositions(newSourcePositions)
    setDestPositions(newDestPositions)
  }, [])

  useLayoutEffect(() => {
    updatePositions()
  }, [fieldMappings, unmappedSourceFields, availableDestFields, filteredSourceFields, filteredDestFields, updatePositions])

  const handleSourceCircleClick = useCallback(
    (fieldId: string) => {
      if (linkState === FieldLinkState.SOURCE_SELECTED && selectedSourceFieldId === fieldId) {
        onSelectSource(null)
      } else {
        onSelectSource(fieldId)
      }
    },
    [linkState, selectedSourceFieldId, onSelectSource],
  )

  const handleDestCircleClick = useCallback(
    async (destFieldId: string) => {
      if (linkState !== FieldLinkState.SOURCE_SELECTED || !selectedSourceFieldId) return

      const sourceField = allSourceFields.find((f) => f.id === selectedSourceFieldId)
      const destField = availableDestFields.find((f) => f.id === destFieldId)
      if (!sourceField || !destField) return

      setActionError('')
      const result = await onCreateLink({
        sourceFieldId: selectedSourceFieldId,
        sourceFieldApiName: sourceField.apiName,
        destFieldId,
        destFieldApiName: destField.apiName,
      })
      if (result.error) {
        setActionError(result.error)
      }
    },
    [linkState, selectedSourceFieldId, allSourceFields, availableDestFields, onCreateLink],
  )

  const handleDeleteLink = useCallback(
    async (fieldMappingId: string) => {
      setActionError('')
      const result = await onDeleteLink(fieldMappingId)
      if (result.error) {
        setActionError(result.error)
      }
    },
    [onDeleteLink],
  )

  const handleAutoMatch = useCallback(async () => {
    setAutoMatching(true)
    setActionError('')
    await onAutoMatch()
    setAutoMatching(false)
  }, [onAutoMatch])

  // Open the migration logic modal for a field mapping
  const handleOpenMigrationLogic = useCallback(
    async (fieldMappingId: string) => {
      const mapping = fieldMappings.find((m) => m.id === fieldMappingId)
      if (!mapping) return

      setActiveMappingMeta({
        sourceFieldLabel: mapping.sourceFieldLabel,
        sourceFieldType: mapping.sourceFieldType,
        destFieldLabel: mapping.destFieldLabel,
        destFieldType: mapping.destFieldType,
        // Picklist values are not available without connector call at this stage —
        // pass empty arrays; the modal will show placeholder text
        sourcePicklistValues: [],
        destPicklistValues: [],
        sampleSourceValues: [],
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
      return migrationLogic.saveMigrationLogic(input as SaveMigrationLogicInput, 'DEFINED')
    },
    [migrationLogic],
  )

  const handleMigrationLogicValidate = useCallback(
    async (input: { sectionType: SectionType; valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>; promptText?: string }) => {
      return migrationLogic.saveMigrationLogic(input as SaveMigrationLogicInput, 'VALIDATED')
    },
    [migrationLogic],
  )

  // Build SVG links data
  const svgLinks = fieldMappings
    .map((m) => {
      const sourcePos = sourcePositions.find((p) => p.fieldId === m.sourceFieldId)
      const destPos = destPositions.find((p) => p.fieldId === m.destFieldId)
      if (!sourcePos || !destPos) return null
      return {
        fieldMappingId: m.id,
        sourceY: sourcePos.centerY,
        destY: destPos.centerY,
        linkStatus: m.linkStatus,
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)

  const hasUnmapped = unmappedSourceFields.length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {fieldMappings.length} field mapping{fieldMappings.length !== 1 ? 's' : ''}
          </span>
          {hasUnmapped && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              {unmappedSourceFields.length} unmapped source field{unmappedSourceFields.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={autoMatching}>
          {autoMatching ? 'Matching...' : 'Auto-match'}
        </Button>
      </div>

      {(error || actionError) && <p className="text-sm text-destructive">{error || actionError}</p>}

      {linkState === FieldLinkState.SOURCE_SELECTED && (
        <p className="text-sm text-primary bg-primary/5 border border-primary/20 rounded px-3 py-2">
          Source field selected. Click a destination field circle to create a link.{' '}
          <button type="button" onClick={() => onSelectSource(null)} className="underline hover:no-underline">
            Cancel
          </button>
        </p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-500 rounded" />
          Compatible
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-orange-500 rounded" />
          Warning
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />
          Incompatible
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_1fr] gap-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {sourceObjectLabel} (Source)
        </h3>
        <div />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {destObjectLabel} (Destination)
        </h3>
      </div>

      {/* Two-column layout with SVG overlay */}
      <div className="relative" ref={svgContainerRef}>
        <div className="grid grid-cols-[1fr_80px_1fr] gap-0">
          {/* Source column */}
          <div className="space-y-2">
            <FieldSearchFilter
              value={sourceSearch}
              onChange={setSourceSearch}
              placeholder="Filter source fields..."
            />
            <div className="space-y-1 mt-2" ref={sourceColRef}>
              {filteredSourceFields.map((field) => (
                <div key={field.id} data-field-id={field.id}>
                  <FieldCard
                    id={field.id}
                    apiName={field.apiName}
                    label={field.label}
                    dataType={field.dataType}
                    isRequired={field.isRequired}
                    role="source"
                    isHighlighted={selectedSourceFieldId === field.id}
                    isMapped={mappedSourceIds.has(field.id)}
                    onCircleClick={handleSourceCircleClick}
                  />
                </div>
              ))}
              {filteredSourceFields.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No fields match your search.</p>
              )}
            </div>
          </div>

          {/* SVG bridge column */}
          <div className="relative">
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              style={{ width: svgWidth || 80, height: svgHeight }}
            >
              {svgLinks.map((link) => (
                <FieldLink
                  key={link.fieldMappingId}
                  sourceY={link.sourceY}
                  destY={link.destY}
                  containerWidth={svgWidth || 80}
                  fieldMappingId={link.fieldMappingId}
                  linkStatus={link.linkStatus}
                  onDelete={handleDeleteLink}
                  onOpenMigrationLogic={handleOpenMigrationLogic}
                />
              ))}
            </svg>
          </div>

          {/* Destination column */}
          <div className="space-y-2">
            <FieldSearchFilter
              value={destSearch}
              onChange={setDestSearch}
              placeholder="Filter destination fields..."
            />
            <div className="space-y-1 mt-2" ref={destColRef}>
              {filteredDestFields.map((field) => (
                <div key={field.id} data-field-id={field.id}>
                  <FieldCard
                    id={field.id}
                    apiName={field.apiName}
                    label={field.label}
                    dataType={field.dataType}
                    isRequired={field.isRequired}
                    role="destination"
                    isMapped={mappedDestIds.has(field.id)}
                    onCircleClick={
                      linkState === FieldLinkState.SOURCE_SELECTED ? handleDestCircleClick : undefined
                    }
                  />
                </div>
              ))}
              {filteredDestFields.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No fields match your search.</p>
              )}
            </div>
          </div>
        </div>
      </div>

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
          sourcePicklistValues={activeMappingMeta.sourcePicklistValues}
          destPicklistValues={activeMappingMeta.destPicklistValues}
          sampleSourceValues={activeMappingMeta.sampleSourceValues}
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
