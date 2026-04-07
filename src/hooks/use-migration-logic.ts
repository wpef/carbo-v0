// 013-migration-logic — Hook for migration logic modal state + save/validate actions

'use client'

import { useState, useCallback } from 'react'
import type {
  MigrationLogicDTO,
  SectionType,
  MigrationLogicStatus,
  SaveMigrationLogicInput,
  ClassifyResult,
} from '@/lib/types/mapping'

interface MigrationLogicState {
  open: boolean
  fieldMappingId: string | null
  planId: string | null
  objectMappingId: string | null
  /** Current migration logic from the server (null = not yet created) */
  migrationLogic: MigrationLogicDTO | null
  /** Section type derived from field types */
  suggestedSection: SectionType | null
  sourceFieldType: string | null
  destinationFieldType: string | null
  /** Type-specific message for D4 sections */
  informationalMessage: string | null
  /** Picklist values from source and destination fields */
  sourcePicklistValues: string[]
  destPicklistValues: string[]
  /** Sample source values for D2 prompt */
  sampleSourceValues: string[]
  loading: boolean
  saving: boolean
  error: string
}

interface OpenMigrationLogicOptions {
  fieldMappingId: string
  planId: string
  objectMappingId: string
  mappingId: string
}

export function useMigrationLogic() {
  const [state, setState] = useState<MigrationLogicState>({
    open: false,
    fieldMappingId: null,
    planId: null,
    objectMappingId: null,
    migrationLogic: null,
    suggestedSection: null,
    sourceFieldType: null,
    destinationFieldType: null,
    informationalMessage: null,
    sourcePicklistValues: [],
    destPicklistValues: [],
    sampleSourceValues: [],
    loading: false,
    saving: false,
    error: '',
  })

  /**
   * Open the migration logic modal for a given field mapping.
   * Fetches existing logic from the server.
   */
  const openModal = useCallback(async (options: OpenMigrationLogicOptions) => {
    const { fieldMappingId, planId, objectMappingId, mappingId } = options

    setState((prev) => ({
      ...prev,
      open: true,
      fieldMappingId,
      planId,
      objectMappingId,
      loading: true,
      error: '',
    }))

    try {
      const url = `/api/plans/${planId}/object-mappings/${mappingId}/fields/${fieldMappingId}/migration-logic`
      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.message ?? 'Failed to load migration logic.',
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        migrationLogic: data.migrationLogic ?? null,
        suggestedSection: data.suggestedSection ?? null,
        sourceFieldType: data.sourceFieldType ?? null,
        destinationFieldType: data.destinationFieldType ?? null,
        informationalMessage: data.informationalMessage ?? null,
        sourcePicklistValues: data.sourcePicklistValues ?? [],
        destPicklistValues: data.destPicklistValues ?? [],
        sampleSourceValues: data.sampleSourceValues ?? [],
        loading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load migration logic.',
      }))
    }
  }, [])

  /**
   * Close the modal and reset state.
   */
  const closeModal = useCallback(() => {
    setState({
      open: false,
      fieldMappingId: null,
      planId: null,
      objectMappingId: null,
      migrationLogic: null,
      suggestedSection: null,
      sourceFieldType: null,
      destinationFieldType: null,
      informationalMessage: null,
      sourcePicklistValues: [],
      destPicklistValues: [],
      sampleSourceValues: [],
      loading: false,
      saving: false,
      error: '',
    })
  }, [])

  /**
   * Save migration logic (status = DEFINED) or validate (status = VALIDATED).
   * Returns { error? } for the caller to handle UI state.
   */
  const saveMigrationLogic = useCallback(
    async (
      input: SaveMigrationLogicInput,
      targetStatus: MigrationLogicStatus,
    ): Promise<{ error?: string }> => {
      if (!state.fieldMappingId || !state.planId || !state.objectMappingId) {
        return { error: 'Modal is not open.' }
      }

      setState((prev) => ({ ...prev, saving: true, error: '' }))

      try {
        const { fieldMappingId, planId, objectMappingId } = state

        // We need mappingId — store it separately via a ref approach
        // Get it from the URL by reconstructing. We stored objectMappingId = mappingId.
        const url = `/api/plans/${planId}/object-mappings/${objectMappingId}/fields/${fieldMappingId}/migration-logic`
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, status: targetStatus }),
        })
        const data = await res.json()

        if (!res.ok) {
          setState((prev) => ({ ...prev, saving: false }))
          return { error: data.message ?? 'Failed to save migration logic.' }
        }

        // Refresh migration logic from server
        const refreshRes = await fetch(url)
        const refreshData = await refreshRes.json()

        setState((prev) => ({
          ...prev,
          migrationLogic: refreshData.migrationLogic ?? null,
          saving: false,
        }))

        return {}
      } catch (err) {
        setState((prev) => ({ ...prev, saving: false }))
        return { error: err instanceof Error ? err.message : 'Failed to save migration logic.' }
      }
    },
    [state],
  )

  /**
   * Classify sample source values using the LLM.
   * Returns classification results or an error.
   */
  const classifySamples = useCallback(
    async (
      promptText: string,
      destinationValues: string[],
      sampleSourceValues: string[],
    ): Promise<{ classifications: ClassifyResult[]; error?: string }> => {
      if (!state.fieldMappingId || !state.planId || !state.objectMappingId) {
        return { classifications: [], error: 'Modal is not open.' }
      }

      try {
        const { fieldMappingId, planId, objectMappingId } = state
        const url = `/api/plans/${planId}/object-mappings/${objectMappingId}/fields/${fieldMappingId}/classify`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptText, destinationValues, sampleSourceValues }),
        })
        const data = await res.json()

        if (!res.ok) {
          return { classifications: [], error: data.message ?? 'Classification failed.' }
        }

        return { classifications: data.classifications ?? [] }
      } catch (err) {
        return {
          classifications: [],
          error: err instanceof Error ? err.message : 'Classification failed.',
        }
      }
    },
    [state],
  )

  return {
    // State
    open: state.open,
    fieldMappingId: state.fieldMappingId,
    migrationLogic: state.migrationLogic,
    suggestedSection: state.suggestedSection,
    sourceFieldType: state.sourceFieldType,
    destinationFieldType: state.destinationFieldType,
    informationalMessage: state.informationalMessage,
    sourcePicklistValues: state.sourcePicklistValues,
    destPicklistValues: state.destPicklistValues,
    sampleSourceValues: state.sampleSourceValues,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    // Actions
    openModal,
    closeModal,
    saveMigrationLogic,
    classifySamples,
  }
}
