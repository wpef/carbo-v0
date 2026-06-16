// 011-object-mapping — T015: React hooks for object-mapping CRUD + auto-link
// Auto-link is triggered on the FIRST load if objectAutoLinkedAt is null (spec FR-004,
// Principle IX: one-shot bootstrap, gated by objectAutoLinkedAt, never re-fires).

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface SchemaObjectItem {
  id: string
  apiName: string
  label: string
  isCustom: boolean
  /** Only present on source objects (from /source/objects) */
  isSelected?: boolean
}

export interface ObjectMappingItem {
  id: string
  planId: string
  sourceObjectName: string
  destinationObjectName: string
  autoCreated: boolean
  fieldAutoMatchedAt: string | null
}

export interface DestSchemaSnapshot {
  id: string
  objects: SchemaObjectItem[]
}

// ─── Primary hook ─────────────────────────────────────────────────────────────

interface ObjectMappingState {
  sourceObjects: SchemaObjectItem[]
  destObjects: SchemaObjectItem[]
  mappings: ObjectMappingItem[]
  /** Non-null if auto-link has already been run (objectAutoLinkedAt IS NOT NULL) */
  objectAutoLinkedAt: string | null
  loading: boolean
  error: string
}

export function useObjectMappings(planId: string) {
  const [state, setState] = useState<ObjectMappingState>({
    sourceObjects: [],
    destObjects: [],
    mappings: [],
    objectAutoLinkedAt: null,
    loading: true,
    error: '',
  })

  // Guard: auto-link must fire at most once per mount, regardless of how many renders
  // happen before the first fetch completes.
  const autoLinkAttemptedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [srcRes, dstRes, mapRes, planRes] = await Promise.all([
        fetch(`/api/plans/${planId}/source/objects`),
        fetch(`/api/plans/${planId}/destination/schema`),
        fetch(`/api/plans/${planId}/object-mappings`),
        fetch(`/api/plans/${planId}`),
      ])

      const [srcData, dstData, mapData, planData] = await Promise.all([
        srcRes.ok
          ? (srcRes.json() as Promise<{ objects?: SchemaObjectItem[] } | SchemaObjectItem[]>).then((d) =>
              Array.isArray(d) ? d : (d.objects ?? []),
            )
          : Promise.resolve<SchemaObjectItem[]>([]),
        dstRes.ok ? (dstRes.json() as Promise<DestSchemaSnapshot | null>) : Promise.resolve(null),
        mapRes.ok ? (mapRes.json() as Promise<ObjectMappingItem[]>) : Promise.resolve([]),
        planRes.ok ? (planRes.json() as Promise<{ objectAutoLinkedAt: string | null }>) : Promise.resolve({ objectAutoLinkedAt: null }),
      ])

      setState({
        // Only selected source objects appear in the mapping view (spec assumption)
        sourceObjects: srcData.filter((o) => o.isSelected !== false),
        destObjects: dstData?.objects ?? [],
        mappings: mapData,
        objectAutoLinkedAt: planData.objectAutoLinkedAt,
        loading: false,
        error: '',
      })

      return planData.objectAutoLinkedAt
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Erreur lors du chargement des données.',
      }))
      return null
    }
  }, [planId])

  // On first mount: fetch then conditionally trigger auto-link (FR-004, Principle IX)
  useEffect(() => {
    const init = async () => {
      const linkedAt = await fetchAll()

      // Auto-link fires only once, only if objectAutoLinkedAt is null (Principle IX).
      if (linkedAt === null && !autoLinkAttemptedRef.current) {
        autoLinkAttemptedRef.current = true
        try {
          await fetch(`/api/plans/${planId}/object-mappings/auto-link`, { method: 'POST' })
          // Re-fetch after auto-link to display the created mappings
          await fetchAll()
        } catch {
          // Auto-link failure is non-fatal — view still renders with empty mappings
        }
      }
    }
    init()
    // fetchAll is memoized on planId, no extra deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const createMapping = useCallback(
    async (sourceObjectName: string, destinationObjectName: string): Promise<{ error?: string; warning?: string }> => {
      const res = await fetch(`/api/plans/${planId}/object-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceObjectName, destinationObjectName }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { error: data.error ?? 'Impossible de créer le mapping.' }
      }
      // Fan-in warning surfaced from API (spec FR-007)
      const warning = Array.isArray(data.warnings) && data.warnings.length > 0
        ? (data.warnings[0] as string)
        : undefined
      await fetchAll()
      return { warning }
    },
    [planId, fetchAll],
  )

  const deleteMapping = useCallback(
    async (mappingId: string): Promise<{ error?: string }> => {
      const res = await fetch(`/api/plans/${planId}/object-mappings/${mappingId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { error: (data as { error?: string }).error ?? 'Suppression échouée.' }
      }
      await fetchAll()
      return {}
    },
    [planId, fetchAll],
  )

  return {
    sourceObjects: state.sourceObjects,
    destObjects: state.destObjects,
    mappings: state.mappings,
    objectAutoLinkedAt: state.objectAutoLinkedAt,
    loading: state.loading,
    error: state.error,
    createMapping,
    deleteMapping,
    refresh: fetchAll,
  }
}

// ─── Stats hook (detail modal) ────────────────────────────────────────────────

interface MappingStats {
  totalSourceFields: number
  mappedFieldCount: number
  validatedFieldCount: number
  filterCount: number
  sourceRecordCount: number | null
  destRecordCount: number | null
}

export function useMappingStats(planId: string, mappingId: string | null) {
  const [stats, setStats] = useState<MappingStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mappingId) {
      setStats(null)
      return
    }
    setLoading(true)
    fetch(`/api/plans/${planId}/object-mappings/${mappingId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats as MappingStats)
        else setStats(null)
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [planId, mappingId])

  return { stats, loading }
}
