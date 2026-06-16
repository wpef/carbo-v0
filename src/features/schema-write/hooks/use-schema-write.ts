// 022-schema-write — React hook for schema write operations (T009 / v4 port)
// All API paths use planId-scoped routes under /api/plans/[planId]/schema-write/*.

'use client'

import { useState, useCallback } from 'react'
import type { ConnectorObject, ConnectorField } from '@/lib/types/connector'
import type { SchemaWriteOperationDTO } from '@/lib/types/schema-write'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaWriteCapability {
  canWriteSchema: boolean
  supportedFieldTypes: string[]
}

interface SchemaWriteState {
  capability: SchemaWriteCapability | null
  capabilityLoading: boolean
  mutating: boolean
  error: string | null
  lastCreatedObject: ConnectorObject | null
  lastCreatedField: ConnectorField | null
  lastOperation: SchemaWriteOperationDTO | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that wraps all schema write API calls for a plan.
 * Routes:
 *   GET  /api/plans/[planId]/schema-write/capability
 *   POST /api/plans/[planId]/schema-write/fields
 *   POST /api/plans/[planId]/schema-write/fields/[fieldApiName]  (PATCH semantics via POST-tunnel)
 *   POST /api/plans/[planId]/schema-write/objects
 */
export function useSchemaWrite(planId: string) {
  const [state, setState] = useState<SchemaWriteState>({
    capability: null,
    capabilityLoading: false,
    mutating: false,
    error: null,
    lastCreatedObject: null,
    lastCreatedField: null,
    lastOperation: null,
  })

  const baseUrl = `/api/plans/${planId}/schema-write`

  // ── Capability check ────────────────────────────────────────────────────

  const fetchCapability = useCallback(async () => {
    setState((prev) => ({ ...prev, capabilityLoading: true, error: null }))
    try {
      const res = await fetch(`${baseUrl}/capability`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
      setState((prev) => ({ ...prev, capability: data as SchemaWriteCapability, capabilityLoading: false }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        capabilityLoading: false,
        error: err instanceof Error ? err.message : 'Failed to check schema write capability',
      }))
    }
  }, [baseUrl])

  // ── Create field ─────────────────────────────────────────────────────────

  const createField = useCallback(
    async (params: {
      objectApiName: string
      name: string
      label: string
      type: string
      description?: string
      picklistValues?: string[]
      group?: string
    }): Promise<{ field: ConnectorField; operation: SchemaWriteOperationDTO } | null> => {
      setState((prev) => ({ ...prev, mutating: true, error: null, lastCreatedField: null, lastOperation: null }))
      try {
        const res = await fetch(`${baseUrl}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
        const result = data as { field: ConnectorField; operation: SchemaWriteOperationDTO }
        setState((prev) => ({ ...prev, mutating: false, lastCreatedField: result.field, lastOperation: result.operation }))
        return result
      } catch (err) {
        setState((prev) => ({
          ...prev,
          mutating: false,
          error: err instanceof Error ? err.message : 'Failed to create field',
        }))
        return null
      }
    },
    [baseUrl],
  )

  // ── Modify field ──────────────────────────────────────────────────────────

  const modifyField = useCallback(
    async (
      objectApiName: string,
      fieldApiName: string,
      updates: {
        name?: string
        label?: string
        type?: string
        description?: string
        picklistValues?: string[]
        group?: string
      },
    ): Promise<{ field: ConnectorField; operation: SchemaWriteOperationDTO } | null> => {
      setState((prev) => ({ ...prev, mutating: true, error: null, lastOperation: null }))
      try {
        const res = await fetch(`${baseUrl}/fields/${encodeURIComponent(fieldApiName)}?objectApiName=${encodeURIComponent(objectApiName)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
        const result = data as { field: ConnectorField; operation: SchemaWriteOperationDTO }
        setState((prev) => ({ ...prev, mutating: false, lastOperation: result.operation }))
        return result
      } catch (err) {
        setState((prev) => ({
          ...prev,
          mutating: false,
          error: err instanceof Error ? err.message : 'Failed to modify field',
        }))
        return null
      }
    },
    [baseUrl],
  )

  // ── Create object ─────────────────────────────────────────────────────────

  const createObject = useCallback(
    async (params: {
      name: string
      label: string
      description?: string
      primaryProperty: { name: string; label: string; type: string }
    }): Promise<{ object: ConnectorObject; operation: SchemaWriteOperationDTO } | null> => {
      setState((prev) => ({ ...prev, mutating: true, error: null, lastCreatedObject: null, lastOperation: null }))
      try {
        const res = await fetch(`${baseUrl}/objects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
        const result = data as { object: ConnectorObject; operation: SchemaWriteOperationDTO }
        setState((prev) => ({ ...prev, mutating: false, lastCreatedObject: result.object, lastOperation: result.operation }))
        return result
      } catch (err) {
        setState((prev) => ({
          ...prev,
          mutating: false,
          error: err instanceof Error ? err.message : 'Failed to create object',
        }))
        return null
      }
    },
    [baseUrl],
  )

  // ── Generate description ──────────────────────────────────────────────────

  const generateDescription = useCallback(
    async (params: {
      objectApiName: string
      objectLabel: string
      fieldName: string
      fieldType: string
      companyContext?: string
      sampleValues?: unknown[]
    }): Promise<string | null> => {
      try {
        const res = await fetch(`${baseUrl}/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? data.message ?? `HTTP ${res.status}`)
        return (data as { description: string }).description
      } catch (err) {
        return null
      }
    },
    [baseUrl],
  )

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    capability: state.capability,
    capabilityLoading: state.capabilityLoading,
    mutating: state.mutating,
    error: state.error,
    lastCreatedObject: state.lastCreatedObject,
    lastCreatedField: state.lastCreatedField,
    lastOperation: state.lastOperation,
    fetchCapability,
    createField,
    modifyField,
    createObject,
    generateDescription,
    clearError,
  }
}
