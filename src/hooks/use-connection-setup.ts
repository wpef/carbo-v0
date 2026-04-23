'use client'

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupPhase =
  | 'IDLE'
  | 'CONNECTING'
  | 'RETRIEVING_SCHEMA'
  | 'SELECTING_OBJECTS'
  | 'RETRIEVING_FIELDS'
  | 'COMPLETE'
  | 'ERROR'

interface SetupResults {
  objectCount: number | null
  selectedCount: number | null
  totalCount: number | null
  fieldCount: number | null
}

interface StartSetupOptions {
  /**
   * Skip the initial POST /source (or /destination-connection) step.
   * Use when the connection is already persisted (e.g., after an OAuth
   * callback that wrote the CONNECTED record server-side).
   * When true, the chain starts at schema retrieval.
   */
  skipConnect?: boolean
}

interface UseConnectionSetupResult {
  phase: SetupPhase
  error: string | null
  results: SetupResults
  startSetup: (adapterType: string, config: Record<string, unknown>, options?: StartSetupOptions) => Promise<void>
  isComplete: boolean
}

// ---------------------------------------------------------------------------
// API path helpers
// ---------------------------------------------------------------------------

function getConnectPath(planId: string, role: 'source' | 'destination') {
  return role === 'source'
    ? `/api/plans/${planId}/source`
    : `/api/plans/${planId}/destination-connection`
}

function getSchemaPath(planId: string, role: 'source' | 'destination') {
  return role === 'source'
    ? `/api/plans/${planId}/source/schema`
    : `/api/plans/${planId}/destination-schema`
}

function getObjectsPath(planId: string) {
  return `/api/plans/${planId}/source/objects`
}

function getFieldsPath(planId: string, role: 'source' | 'destination') {
  return role === 'source'
    ? `/api/plans/${planId}/source/fields`
    : `/api/plans/${planId}/destination-fields`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConnectionSetup(planId: string, role: 'source' | 'destination'): UseConnectionSetupResult {
  const [phase, setPhase] = useState<SetupPhase>('IDLE')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SetupResults>({
    objectCount: null,
    selectedCount: null,
    totalCount: null,
    fieldCount: null,
  })

  const startSetup = useCallback(async (
    adapterType: string,
    config: Record<string, unknown>,
    options?: StartSetupOptions,
  ) => {
    setError(null)
    setResults({ objectCount: null, selectedCount: null, totalCount: null, fieldCount: null })

    try {
      if (!options?.skipConnect) {
        // Step 1: Connect (skipped when the connection is already persisted,
        // e.g. after an OAuth callback wrote the CONNECTED record).
        setPhase('CONNECTING')
        const connectRes = await fetch(getConnectPath(planId, role), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adapterType, config }),
        })
        if (!connectRes.ok) {
          const data = await connectRes.json().catch(() => ({}))
          throw new Error(data.message ?? data.error ?? 'Connection failed.')
        }
      }

      // Step 2: Retrieve schema
      setPhase('RETRIEVING_SCHEMA')
      const schemaRes = await fetch(getSchemaPath(planId, role), { method: 'POST' })
      if (!schemaRes.ok) {
        const data = await schemaRes.json().catch(() => ({}))
        throw new Error(data.message ?? data.error ?? 'Schema retrieval failed.')
      }
      const schemaData = await schemaRes.json()
      const objectCount = schemaData.snapshot?.objectCount ?? schemaData.objects?.length ?? 0
      setResults((prev) => ({ ...prev, objectCount }))

      // Step 3: Init object selection (source only — triggers auto-selection on GET)
      if (role === 'source') {
        setPhase('SELECTING_OBJECTS')
        const objectsRes = await fetch(getObjectsPath(planId))
        if (!objectsRes.ok) {
          const data = await objectsRes.json().catch(() => ({}))
          throw new Error(data.message ?? data.error ?? 'Object selection failed.')
        }
        const objectsData = await objectsRes.json()
        const objects = objectsData.objects ?? []
        const selected = objects.filter((o: { isSelected: boolean }) => o.isSelected).length
        setResults((prev) => ({ ...prev, selectedCount: selected, totalCount: objects.length }))
      }

      // Step 4: Retrieve fields
      setPhase('RETRIEVING_FIELDS')
      const fieldsRes = await fetch(getFieldsPath(planId, role), { method: 'POST' })
      if (!fieldsRes.ok) {
        const data = await fieldsRes.json().catch(() => ({}))
        throw new Error(data.message ?? data.error ?? 'Field retrieval failed.')
      }
      const fieldsData = await fieldsRes.json()
      const fieldCount = fieldsData.totalFields ?? fieldsData.results?.reduce(
        (sum: number, r: { fieldCount?: number }) => sum + (r.fieldCount ?? 0), 0
      ) ?? 0
      setResults((prev) => ({ ...prev, fieldCount }))

      setPhase('COMPLETE')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.')
      setPhase('ERROR')
    }
  }, [planId, role])

  return {
    phase,
    error,
    results,
    startSetup,
    isComplete: phase === 'COMPLETE',
  }
}
