// 013-migration-logic — Hook: migration logic modal state + save/validate actions
// Ported from v3 src/hooks/use-migration-logic.ts with URL adapted to v4 route structure.
//
// v4 route: /api/plans/[planId]/object-mappings/[mappingId]/field-mappings/[fieldMappingId]/migration-logic

'use client'

import { useState, useCallback, useRef } from 'react'
import type { SectionType, MigrationLogicDTO } from '../services/migration-logic-service'
import type { ClassifyResult } from '../services/classify-service'

// ─── State ────────────────────────────────────────────────────────────────────

interface MigrationLogicModalState {
  open: boolean
  planId: string | null
  objectMappingId: string | null
  fieldMappingId: string | null
  /** Server-loaded migration logic (null = not yet saved) */
  migrationLogic: MigrationLogicDTO | null
  /** Derived section type from field types */
  sectionType: SectionType | null
  sourceFieldLabel: string
  sourceFieldType: string
  destFieldLabel: string
  destFieldType: string
  informationalMessage: string | null
  sourcePicklistValues: string[]
  destPicklistValues: string[]
  sampleSourceValues: string[]
  loading: boolean
  saving: boolean
  error: string
}

const INITIAL_STATE: MigrationLogicModalState = {
  open: false,
  planId: null,
  objectMappingId: null,
  fieldMappingId: null,
  migrationLogic: null,
  sectionType: null,
  sourceFieldLabel: '',
  sourceFieldType: '',
  destFieldLabel: '',
  destFieldType: '',
  informationalMessage: null,
  sourcePicklistValues: [],
  destPicklistValues: [],
  sampleSourceValues: [],
  loading: false,
  saving: false,
  error: '',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMigrationLogic() {
  const [state, setState] = useState<MigrationLogicModalState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Open the modal for a given field mapping.
   * Fetches existing logic + field metadata from the server.
   */
  const openModal = useCallback(
    async (opts: {
      planId: string
      objectMappingId: string
      fieldMappingId: string
      /** Optional field labels/types for immediate display while loading */
      sourceFieldLabel?: string
      sourceFieldType?: string
      destFieldLabel?: string
      destFieldType?: string
    }) => {
      const { planId, objectMappingId, fieldMappingId } = opts

      setState((prev) => ({
        ...prev,
        open: true,
        planId,
        objectMappingId,
        fieldMappingId,
        sourceFieldLabel: opts.sourceFieldLabel ?? '',
        sourceFieldType: opts.sourceFieldType ?? '',
        destFieldLabel: opts.destFieldLabel ?? '',
        destFieldType: opts.destFieldType ?? '',
        loading: true,
        error: '',
        migrationLogic: null,
        sectionType: null,
      }))

      const url =
        `/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings/${fieldMappingId}/migration-logic`

      try {
        const res = await fetch(url)
        const data = await res.json()

        if (!res.ok && res.status !== 404) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error ?? 'Impossible de charger la logique de migration.',
          }))
          return
        }

        // Both 200 (logic exists) and 404 (not created yet) return the field + sectionType context
        setState((prev) => ({
          ...prev,
          loading: false,
          migrationLogic: data.id ? (data as MigrationLogicDTO) : null,
          sectionType: data.sectionType ?? null,
          sourceFieldLabel: data.sourceField?.label ?? prev.sourceFieldLabel,
          sourceFieldType: data.sourceField?.type ?? prev.sourceFieldType,
          destFieldLabel: data.destinationField?.label ?? prev.destFieldLabel,
          destFieldType: data.destinationField?.type ?? prev.destFieldType,
          informationalMessage: data.informationalMessage ?? null,
          sourcePicklistValues: data.sourceField?.picklistValues ?? [],
          destPicklistValues: data.destinationField?.picklistValues ?? [],
          sampleSourceValues: data.sampleSourceValues ?? [],
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Erreur inattendue.',
        }))
      }
    },
    [],
  )

  /**
   * Close the modal and reset to initial state.
   */
  const closeModal = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  /**
   * Build the PUT URL from current stateRef.
   */
  function buildUrl() {
    const { planId, objectMappingId, fieldMappingId } = stateRef.current
    if (!planId || !objectMappingId || !fieldMappingId) return null
    return `/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings/${fieldMappingId}/migration-logic`
  }

  /**
   * Save (DEFINED) or validate (VALIDATED) migration logic.
   */
  const saveMigration = useCallback(
    async (input: {
      sectionType: SectionType
      valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
      promptText?: string
    }, targetStatus: 'DEFINED' | 'VALIDATED'): Promise<{ error?: string }> => {
      const url = buildUrl()
      if (!url) return { error: 'La modale n\'est pas ouverte.' }

      setState((prev) => ({ ...prev, saving: true, error: '' }))

      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, action: targetStatus === 'VALIDATED' ? 'VALIDATE' : 'SAVE' }),
        })
        const data = await res.json()

        if (!res.ok) {
          setState((prev) => ({ ...prev, saving: false }))
          return { error: data.error ?? 'Échec de la sauvegarde.' }
        }

        // Reload the full logic from server to refresh state
        const refreshRes = await fetch(url)
        const refreshData = await refreshRes.json()
        setState((prev) => ({
          ...prev,
          saving: false,
          migrationLogic: refreshData.id ? (refreshData as MigrationLogicDTO) : null,
        }))

        return {}
      } catch (err) {
        setState((prev) => ({ ...prev, saving: false }))
        return { error: err instanceof Error ? err.message : 'Erreur inattendue.' }
      }
    },
    [], // stateRef avoids stale closure
  )

  const onSave = useCallback(
    (input: {
      sectionType: SectionType
      valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
      promptText?: string
    }) => saveMigration(input, 'DEFINED'),
    [saveMigration],
  )

  const onValidate = useCallback(
    (input: {
      sectionType: SectionType
      valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
      promptText?: string
    }) => saveMigration(input, 'VALIDATED'),
    [saveMigration],
  )

  /**
   * Classify sample values via the /classify route.
   */
  const onClassify = useCallback(
    async (
      promptText: string,
      destinationValues: string[],
      sampleSourceValues: string[],
    ): Promise<{ classifications: ClassifyResult[]; error?: string }> => {
      const { planId, objectMappingId, fieldMappingId } = stateRef.current
      if (!planId || !objectMappingId || !fieldMappingId) {
        return { classifications: [], error: 'La modale n\'est pas ouverte.' }
      }

      const url =
        `/api/plans/${planId}/object-mappings/${objectMappingId}/field-mappings/${fieldMappingId}/migration-logic/classify`

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, destinationValues, sampleSourceValues }),
        })
        const data = await res.json()
        if (!res.ok) {
          return { classifications: [], error: data.error ?? 'Classification échouée.' }
        }
        return { classifications: data.classifications ?? [] }
      } catch (err) {
        return { classifications: [], error: err instanceof Error ? err.message : 'Erreur inattendue.' }
      }
    },
    [], // stateRef avoids stale closure
  )

  return {
    // State
    open: state.open,
    sectionType: state.sectionType,
    sourceFieldLabel: state.sourceFieldLabel,
    sourceFieldType: state.sourceFieldType,
    destFieldLabel: state.destFieldLabel,
    destFieldType: state.destFieldType,
    informationalMessage: state.informationalMessage,
    migrationLogic: state.migrationLogic,
    sourcePicklistValues: state.sourcePicklistValues,
    destPicklistValues: state.destPicklistValues,
    sampleSourceValues: state.sampleSourceValues,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    // Actions
    openModal,
    closeModal,
    onSave,
    onValidate,
    onClassify,
  }
}
