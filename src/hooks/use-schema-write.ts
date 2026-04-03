// 022-schema-write — Hook for schema write operations

'use client'

import { useState, useCallback } from 'react'
import type { SchemaWriteCapability } from '@/lib/services/schema-write/types'
import type { ConnectorObject, ConnectorField } from '@/lib/connectors/types'

interface SchemaWriteState {
  capability: SchemaWriteCapability | null
  capabilityLoading: boolean
  creating: boolean
  error: string | null
  lastCreatedObject: ConnectorObject | null
  lastCreatedField: ConnectorField | null
}

export function useSchemaWrite(planId: string) {
  const [state, setState] = useState<SchemaWriteState>({
    capability: null,
    capabilityLoading: false,
    creating: false,
    error: null,
    lastCreatedObject: null,
    lastCreatedField: null,
  })

  const capabilityApiPath = `/api/plans/${planId}/schema-write/capability`
  const objectsApiPath = `/api/plans/${planId}/schema-write/objects`
  const fieldsApiPath = `/api/plans/${planId}/schema-write/fields`

  /**
   * Fetch schema write capability for the plan's destination adapter.
   */
  const fetchCapability = useCallback(async () => {
    setState((prev) => ({ ...prev, capabilityLoading: true, error: null }))
    try {
      const res = await fetch(capabilityApiPath)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? 'Failed to check schema write capability.')
      }
      setState((prev) => ({
        ...prev,
        capability: data as SchemaWriteCapability,
        capabilityLoading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        capabilityLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [capabilityApiPath])

  /**
   * Create a new object in the destination system.
   */
  const createObject = useCallback(
    async (apiName: string, label: string): Promise<ConnectorObject | null> => {
      setState((prev) => ({ ...prev, creating: true, error: null, lastCreatedObject: null }))
      try {
        const res = await fetch(objectsApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiName, label }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message ?? 'Failed to create object.')
        }
        const created = data.object as ConnectorObject
        setState((prev) => ({ ...prev, creating: false, lastCreatedObject: created }))
        return created
      } catch (err) {
        setState((prev) => ({
          ...prev,
          creating: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
        return null
      }
    },
    [objectsApiPath],
  )

  /**
   * Create a new field in the destination object.
   */
  const createField = useCallback(
    async (params: {
      objectApiName: string
      apiName: string
      label: string
      dataType: string
      isRequired: boolean
    }): Promise<ConnectorField | null> => {
      setState((prev) => ({ ...prev, creating: true, error: null, lastCreatedField: null }))
      try {
        const res = await fetch(fieldsApiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message ?? 'Failed to create field.')
        }
        const created = data.field as ConnectorField
        setState((prev) => ({ ...prev, creating: false, lastCreatedField: created }))
        return created
      } catch (err) {
        setState((prev) => ({
          ...prev,
          creating: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
        return null
      }
    },
    [fieldsApiPath],
  )

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    capability: state.capability,
    capabilityLoading: state.capabilityLoading,
    creating: state.creating,
    error: state.error,
    lastCreatedObject: state.lastCreatedObject,
    lastCreatedField: state.lastCreatedField,
    fetchCapability,
    createObject,
    createField,
    clearError,
  }
}
