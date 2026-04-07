// 013-migration-logic — C2: Migration logic modal
// Two-column header (source field left, dest field right) + type-specific section (D1-D4) + action buttons.

'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ValueEquivalenceSection } from './ValueEquivalenceSection'
import { ClassificationPromptSection } from './ClassificationPromptSection'
import { IncompatibleErrorSection } from './IncompatibleErrorSection'
import { InformationalCopySection } from './InformationalCopySection'
import type { MigrationLogicDTO, SectionType, ValueEquivalenceDTO, ClassifyResult } from '@/lib/types/mapping'

interface MigrationLogicModalProps {
  open: boolean
  onClose: () => void
  /** Source field info */
  sourceFieldLabel: string
  sourceFieldType: string
  /** Destination field info */
  destFieldLabel: string
  destFieldType: string
  /** Section type to display */
  sectionType: SectionType
  /** Informational message for D4 */
  informationalMessage: string | null
  /** Existing migration logic (null = not yet saved) */
  migrationLogic: MigrationLogicDTO | null
  /** Source picklist values (for D1) */
  sourcePicklistValues: string[]
  /** Destination picklist values (for D1 and D2) */
  destPicklistValues: string[]
  /** Sample source record values (for D2) */
  sampleSourceValues: string[]
  /** Loading state */
  loading: boolean
  /** Saving state */
  saving: boolean
  /** Error message */
  error: string
  /** Save callback (status = DEFINED) */
  onSave: (input: {
    sectionType: SectionType
    valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
    promptText?: string
  }) => Promise<{ error?: string }>
  /** Validate callback (status = VALIDATED) */
  onValidate: (input: {
    sectionType: SectionType
    valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
    promptText?: string
  }) => Promise<{ error?: string }>
  /** Classify samples callback */
  onClassify: (
    promptText: string,
    destinationValues: string[],
    sampleSourceValues: string[],
  ) => Promise<{ classifications: ClassifyResult[]; error?: string }>
}

export function MigrationLogicModal({
  open,
  onClose,
  sourceFieldLabel,
  sourceFieldType,
  destFieldLabel,
  destFieldType,
  sectionType,
  informationalMessage,
  migrationLogic,
  sourcePicklistValues,
  destPicklistValues,
  sampleSourceValues,
  loading,
  saving,
  error,
  onSave,
  onValidate,
  onClassify,
}: MigrationLogicModalProps) {
  // Local state for D1 equivalences
  const [currentEquivalences, setCurrentEquivalences] = useState<
    Array<{ sourceValue: string; destinationValue: string }>
  >([])

  // Local state for D2 prompt
  const [currentPromptText, setCurrentPromptText] = useState(
    migrationLogic?.classificationPrompt?.promptText ?? '',
  )

  const [actionError, setActionError] = useState('')

  const handleEquivalencesChange = useCallback(
    (equivs: Array<{ sourceValue: string; destinationValue: string }>) => {
      setCurrentEquivalences(equivs)
    },
    [],
  )

  const handlePromptChange = useCallback((text: string) => {
    setCurrentPromptText(text)
  }, [])

  const handleSave = useCallback(async () => {
    setActionError('')
    const input = buildInput()
    const result = await onSave(input)
    if (result.error) {
      setActionError(result.error)
    } else {
      onClose()
    }
  }, [sectionType, currentEquivalences, currentPromptText, onSave, onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleValidate = useCallback(async () => {
    setActionError('')
    const input = buildInput()
    const result = await onValidate(input)
    if (result.error) {
      setActionError(result.error)
    } else {
      onClose()
    }
  }, [sectionType, currentEquivalences, currentPromptText, onValidate, onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  function buildInput() {
    return {
      sectionType,
      ...(sectionType === 'VALUE_EQUIVALENCE' ? { valueEquivalences: currentEquivalences } : {}),
      ...(sectionType === 'PROMPT' ? { promptText: currentPromptText } : {}),
    }
  }

  const isError = sectionType === 'ERROR'
  const isInformational = sectionType === 'INFORMATIONAL'

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      text: 'Text',
      number: 'Number',
      date: 'Date',
      picklist: 'Picklist',
      boolean: 'Checkbox',
      multipicklist: 'Multi-Picklist',
    }
    return map[type.toLowerCase()] ?? type
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-2xl w-full"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Migration Logic</DialogTitle>

          {/* Two-column field header */}
          <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-muted/30 rounded-md border border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Source</p>
              <p className="font-medium text-sm">{sourceFieldLabel}</p>
              <p className="text-xs text-muted-foreground">{typeLabel(sourceFieldType)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Destination</p>
              <p className="font-medium text-sm">{destFieldLabel}</p>
              <p className="text-xs text-muted-foreground">{typeLabel(destFieldType)}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Section content */}
        <div className="py-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : sectionType === 'VALUE_EQUIVALENCE' ? (
            <ValueEquivalenceSection
              sourceValues={sourcePicklistValues}
              destinationValues={destPicklistValues}
              initialEquivalences={migrationLogic?.valueEquivalences ?? []}
              onChange={handleEquivalencesChange}
            />
          ) : sectionType === 'PROMPT' ? (
            <ClassificationPromptSection
              destinationValues={destPicklistValues}
              sampleSourceValues={sampleSourceValues}
              initialPromptText={migrationLogic?.classificationPrompt?.promptText ?? ''}
              onPromptChange={handlePromptChange}
              onClassify={onClassify}
            />
          ) : sectionType === 'ERROR' ? (
            <IncompatibleErrorSection />
          ) : sectionType === 'INFORMATIONAL' ? (
            <InformationalCopySection message={informationalMessage ?? 'The value will be copied as-is.'} />
          ) : null}
        </div>

        {/* Error display */}
        {(error || actionError) && (
          <p className="text-sm text-destructive -mt-2">{error || actionError}</p>
        )}

        {/* Footer with action buttons */}
        <DialogFooter>
          {/* Cancel */}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>

          {/* Enregistrer — hidden for D3 (Error) and D4 (Informational) */}
          {!isError && !isInformational && (
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          )}

          {/* Valider — disabled for D3 (Error) */}
          <Button
            onClick={handleValidate}
            disabled={saving || isError}
          >
            {saving ? 'Validation...' : 'Valider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
