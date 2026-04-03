// 022-schema-write — Schema write panel component

'use client'

import { useState, useEffect } from 'react'
import { CreateObjectForm } from './create-object-form'
import { CreateFieldForm } from './create-field-form'
import { useSchemaWrite } from '@/hooks/use-schema-write'
import type { ConnectorObject } from '@/lib/connectors/types'

interface SchemaWritePanelProps {
  planId: string
  destinationObjects?: Array<{ apiName: string; label: string }>
  onSchemaChanged?: () => void
}

export function SchemaWritePanel({ planId, destinationObjects = [], onSchemaChanged }: SchemaWritePanelProps) {
  const [activeTab, setActiveTab] = useState<'object' | 'field'>('field')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    capability,
    capabilityLoading,
    creating,
    error,
    fetchCapability,
    createObject,
    createField,
    clearError,
  } = useSchemaWrite(planId)

  useEffect(() => {
    fetchCapability()
  }, [fetchCapability])

  async function handleCreateObject(apiName: string, label: string) {
    setSuccessMessage(null)
    clearError()
    const result = await createObject(apiName, label)
    if (result) {
      setSuccessMessage(`Object "${result.label}" (${result.apiName}) created successfully.`)
      onSchemaChanged?.()
    }
  }

  async function handleCreateField(params: {
    objectApiName: string
    apiName: string
    label: string
    dataType: string
    isRequired: boolean
  }) {
    setSuccessMessage(null)
    clearError()
    const result = await createField(params)
    if (result) {
      setSuccessMessage(`Field "${result.label}" (${result.apiName}) created successfully in ${params.objectApiName}.`)
      onSchemaChanged?.()
    }
  }

  if (capabilityLoading) {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">Checking schema write capability...</p>
      </div>
    )
  }

  if (!capability) {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">
          Unable to determine schema write capability. Ensure a destination connection is configured.
        </p>
      </div>
    )
  }

  if (!capability.canWriteSchema) {
    return (
      <div className="rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold mb-2">Schema Write Unavailable</h3>
        <p className="text-sm text-muted-foreground">
          The <span className="font-medium">{capability.adapterType}</span> adapter does not support
          creating objects or fields in the destination system. Use the destination system&apos;s native
          UI to make schema changes, then refresh the destination schema.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab('field')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'field'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Add Field
        </button>
        <button
          onClick={() => setActiveTab('object')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'object'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Add Object
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Active form */}
      <div className="rounded-lg border border-border p-6">
        {activeTab === 'field' ? (
          <>
            <h3 className="text-sm font-semibold mb-4">Add Field to Destination Object</h3>
            <CreateFieldForm
              destinationObjects={destinationObjects}
              onSubmit={handleCreateField}
              isLoading={creating}
            />
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold mb-4">Create New Destination Object</h3>
            <CreateObjectForm onSubmit={handleCreateObject} isLoading={creating} />
          </>
        )}
      </div>
    </div>
  )
}
