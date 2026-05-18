'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { listAdapterTypes } from '@/lib/adapters/registry'

interface ConnectionState {
  id: string
  adapterType: string
  name: string
  status: string
}

interface SchemaObject {
  id: string
  apiName: string
  label: string
  isCustom: boolean
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

interface SchemaSnapshot {
  id: string
  objects: SchemaObject[]
}

export function DestinationConnectionPage({ planId }: { planId: string }) {
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null)
  const [fields, setFields] = useState<FieldsByObject>({})
  const [expandedObject, setExpandedObject] = useState<string | null>(null)
  const [fetchingSchema, setFetchingSchema] = useState(false)
  const [fetchingFields, setFetchingFields] = useState(false)
  const [fieldsReady, setFieldsReady] = useState(false)

  useEffect(() => {
    fetch(`/api/plans/${planId}/destination`)
      .then((r) => r.json())
      .then((data) => {
        setConnection(data)
        if (data) loadSchemaAndFields()
      })
      .finally(() => setLoading(false))
  }, [planId])

  const loadSchemaAndFields = useCallback(async () => {
    const schemaRes = await fetch(`/api/plans/${planId}/destination/schema`)
    const schemaData = await schemaRes.json()
    if (schemaData) {
      setSchema(schemaData)
      const fieldsRes = await fetch(`/api/plans/${planId}/destination/fields`)
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
      const res = await fetch(`/api/plans/${planId}/destination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterType, config: { name: `${adapterType} destination` } }),
      })
      if (res.ok) {
        const data = await res.json()
        setConnection(data.connection)
        setFieldsReady(false)
        await handleFetchSchema()
      }
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await fetch(`/api/plans/${planId}/destination`, { method: 'DELETE' })
    setConnection(null)
    setSchema(null)
    setFields({})
    setFieldsReady(false)
  }

  async function handleFetchSchema() {
    setFetchingSchema(true)
    try {
      const res = await fetch(`/api/plans/${planId}/destination/schema`, { method: 'POST' })
      if (res.ok) {
        setSchema(await res.json())
      }
    } finally {
      setFetchingSchema(false)
    }
  }

  async function handleFetchFields() {
    setFetchingFields(true)
    try {
      const res = await fetch(`/api/plans/${planId}/destination/fields`, { method: 'POST' })
      if (res.ok) {
        const fieldsRes = await fetch(`/api/plans/${planId}/destination/fields`)
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
      body: JSON.stringify({ targetStep: 'OBJECT_MAPPING' }),
    })
    window.location.href = `/plans/${planId}/object-mapping`
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  if (!connection) {
    const adapterTypes = listAdapterTypes()
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Select a destination adapter to connect:</p>
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

  const objects = schema?.objects ?? []

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

      {objects.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold mb-3">Destination Objects ({objects.length})</h3>
            <div className="space-y-2">
              {objects.map((obj) => (
                <Card key={obj.id} className="p-3">
                  <div className="flex items-center gap-3">
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
                    <div className="mt-3 ml-4 space-y-1">
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

      {objects.length > 0 && !fieldsReady && (
        <Button onClick={handleFetchFields} disabled={fetchingFields} className="w-full">
          {fetchingFields ? 'Retrieving fields...' : `Retrieve Fields for ${objects.length} Objects`}
        </Button>
      )}

      {fieldsReady && (
        <Button onClick={handleAdvanceStep} className="w-full">
          Continue to Object Mapping →
        </Button>
      )}
    </div>
  )
}
