'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { listAdapterTypes } from '@/lib/adapters/registry'

interface ConnectionState {
  id: string
  adapterType: string
  name: string
  status: string
}

interface SchemaObjectWithSelection {
  id: string
  apiName: string
  label: string
  isCustom: boolean
  isSelected: boolean
  fields: FieldState[]
}

interface FieldState {
  id: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  referenceTo?: string | null
  relationshipType?: string | null
}

type FieldsByObject = Record<string, FieldState[]>

export function SourceConnectionPage({ planId }: { planId: string }) {
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [objects, setObjects] = useState<SchemaObjectWithSelection[]>([])
  const [fields, setFields] = useState<FieldsByObject>({})
  const [expandedObject, setExpandedObject] = useState<string | null>(null)
  const [fetchingSchema, setFetchingSchema] = useState(false)
  const [fetchingFields, setFetchingFields] = useState(false)
  const [schemaReady, setSchemaReady] = useState(false)
  const [fieldsReady, setFieldsReady] = useState(false)

  useEffect(() => {
    fetch(`/api/plans/${planId}/source`)
      .then((r) => r.json())
      .then((data) => {
        setConnection(data)
        if (data) {
          loadSchemaAndObjects()
        }
      })
      .finally(() => setLoading(false))
  }, [planId])

  const loadSchemaAndObjects = useCallback(async () => {
    const schemaRes = await fetch(`/api/plans/${planId}/source/schema`)
    const schema = await schemaRes.json()
    if (schema) {
      setSchemaReady(true)
      const objRes = await fetch(`/api/plans/${planId}/source/objects`)
      const objs = await objRes.json()
      setObjects(objs)

      const fieldsRes = await fetch(`/api/plans/${planId}/source/fields`)
      const fieldsData = await fieldsRes.json()
      if (Object.keys(fieldsData).length > 0) {
        setFields(fieldsData)
        setFieldsReady(true)
      }
    }
  }, [planId])

  async function handleConnect(adapterType: string) {
    setConnecting(true)
    try {
      const res = await fetch(`/api/plans/${planId}/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterType, config: { name: `${adapterType} source` } }),
      })
      if (res.ok) {
        const data = await res.json()
        setConnection(data.connection)
        setSchemaReady(false)
        setFieldsReady(false)
        await handleFetchSchema()
      }
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await fetch(`/api/plans/${planId}/source`, { method: 'DELETE' })
    setConnection(null)
    setObjects([])
    setFields({})
    setSchemaReady(false)
    setFieldsReady(false)
  }

  async function handleFetchSchema() {
    setFetchingSchema(true)
    try {
      const res = await fetch(`/api/plans/${planId}/source/schema`, { method: 'POST' })
      if (res.ok) {
        setSchemaReady(true)
        const objRes = await fetch(`/api/plans/${planId}/source/objects`)
        setObjects(await objRes.json())
      }
    } finally {
      setFetchingSchema(false)
    }
  }

  async function handleToggleSelection(objectApiName: string, isSelected: boolean) {
    const updated = objects.map((o) => (o.apiName === objectApiName ? { ...o, isSelected } : o))
    setObjects(updated)
    await fetch(`/api/plans/${planId}/source/objects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: [{ objectApiName, isSelected }] }),
    })
  }

  async function handleSelectAll(isSelected: boolean) {
    const updated = objects.map((o) => ({ ...o, isSelected }))
    setObjects(updated)
    await fetch(`/api/plans/${planId}/source/objects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: objects.map((o) => ({ objectApiName: o.apiName, isSelected })) }),
    })
  }

  async function handleFetchFields() {
    setFetchingFields(true)
    try {
      const res = await fetch(`/api/plans/${planId}/source/fields`, { method: 'POST' })
      if (res.ok) {
        const fieldsRes = await fetch(`/api/plans/${planId}/source/fields`)
        setFields(await fieldsRes.json())
        setFieldsReady(true)
      }
    } finally {
      setFetchingFields(false)
    }
  }

  async function handleAdvanceStep() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStep: 'DESTINATION' }),
    })
    window.location.href = `/plans/${planId}/destination`
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  if (!connection) {
    const adapterTypes = listAdapterTypes()
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Select a source adapter to connect:</p>
        <div className="grid gap-3 max-w-md">
          {adapterTypes.map((type) => (
            <Button
              key={type}
              variant="outline"
              className="justify-start h-auto py-3"
              onClick={() => handleConnect(type)}
              disabled={connecting}
            >
              <span className="font-medium capitalize">{type}</span>
              <span className="ml-2 text-muted-foreground text-sm">
                {type === 'demo' ? '(Mock data for testing)' : ''}
              </span>
            </Button>
          ))}
        </div>
      </div>
    )
  }

  const selectedCount = objects.filter((o) => o.isSelected).length

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{connection.name}</h3>
            <p className="text-sm text-muted-foreground">Adapter: {connection.adapterType}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default">{connection.status}</Badge>
            <Button variant="outline" size="sm" onClick={handleFetchSchema} disabled={fetchingSchema}>
              {fetchingSchema ? 'Refreshing...' : 'Refresh Schema'}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      </Card>

      {schemaReady && objects.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Objects ({selectedCount}/{objects.length} selected)
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleSelectAll(true)}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleSelectAll(false)}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {objects.map((obj) => (
                <Card key={obj.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={obj.isSelected}
                      onCheckedChange={(checked) =>
                        handleToggleSelection(obj.apiName, checked === true)
                      }
                    />
                    <button
                      className="flex-1 text-left"
                      onClick={() =>
                        setExpandedObject(expandedObject === obj.apiName ? null : obj.apiName)
                      }
                    >
                      <span className="font-medium">{obj.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">({obj.apiName})</span>
                      {obj.isCustom && (
                        <Badge variant="secondary" className="ml-2">
                          Custom
                        </Badge>
                      )}
                    </button>
                    {fields[obj.apiName] && (
                      <Badge variant="outline">{fields[obj.apiName].length} fields</Badge>
                    )}
                  </div>
                  {expandedObject === obj.apiName && fields[obj.apiName] && (
                    <div className="mt-3 ml-8 space-y-1">
                      {fields[obj.apiName].map((f) => (
                        <div key={f.apiName} className="flex items-center gap-2 text-sm py-1">
                          <span className="font-mono text-xs w-32 truncate">{f.apiName}</span>
                          <Badge variant="outline" className="text-xs">
                            {f.dataType}
                          </Badge>
                          {f.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              required
                            </Badge>
                          )}
                          {f.isReadOnly && (
                            <Badge variant="secondary" className="text-xs">
                              read-only
                            </Badge>
                          )}
                          {f.referenceTo && (
                            <span className="text-xs text-muted-foreground">
                              → {f.referenceTo}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {schemaReady && selectedCount > 0 && !fieldsReady && (
        <Button onClick={handleFetchFields} disabled={fetchingFields} className="w-full">
          {fetchingFields
            ? 'Retrieving fields...'
            : `Retrieve Fields for ${selectedCount} Objects`}
        </Button>
      )}

      {fieldsReady && (
        <Button onClick={handleAdvanceStep} className="w-full">
          Continue to Destination →
        </Button>
      )}
    </div>
  )
}
