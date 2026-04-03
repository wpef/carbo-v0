// 003-source-schema-retrieval — Schema hook

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SchemaDiff } from '@/lib/types/schema'

interface SchemaObject {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
}

interface SchemaSnapshotMeta {
  id: string
  connectionId: string
  role: string
  status: string
  objectCount: number
  retrievedAt: string
}

interface SchemaState {
  snapshot: SchemaSnapshotMeta | null
  objects: SchemaObject[]
  diff: SchemaDiff | null
  loading: boolean
  retrieving: boolean
  error: string
}

// Derive the API base path from role:
// - source  → /api/plans/:planId/source/schema
// - destination → /api/plans/:planId/destination-schema
function getSchemaApiPath(planId: string, role: 'source' | 'destination'): string {
  if (role === 'destination') {
    return `/api/plans/${planId}/destination-schema`
  }
  return `/api/plans/${planId}/source/schema`
}

export function useSchema(planId: string, role: 'source' | 'destination' = 'source') {
  const [state, setState] = useState<SchemaState>({
    snapshot: null,
    objects: [],
    diff: null,
    loading: true,
    retrieving: false,
    error: '',
  })

  const apiPath = getSchemaApiPath(planId, role)

  const fetchSnapshot = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const res = await fetch(apiPath)
      if (res.status === 404) {
        // No snapshot yet — not an error
        setState((prev) => ({ ...prev, snapshot: null, objects: [], loading: false }))
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Failed to load schema.')
      }
      const data: { snapshot: SchemaSnapshotMeta; objects: SchemaObject[] } = await res.json()
      setState((prev) => ({ ...prev, snapshot: data.snapshot, objects: data.objects, loading: false }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [apiPath])

  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  const retrieveSchema = useCallback(async () => {
    setState((prev) => ({ ...prev, retrieving: true, error: '' }))
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Failed to retrieve schema.')
      }
      const data: { snapshot: SchemaSnapshotMeta; objects: SchemaObject[]; diff: SchemaDiff | null } = await res.json()
      setState((prev) => ({
        ...prev,
        snapshot: data.snapshot,
        objects: data.objects,
        diff: data.diff,
        retrieving: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        retrieving: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [apiPath])

  return {
    snapshot: state.snapshot,
    objects: state.objects,
    diff: state.diff,
    loading: state.loading,
    retrieving: state.retrieving,
    error: state.error,
    retrieveSchema,
  }
}
