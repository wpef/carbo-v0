'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listAdapterTypes } from '@/lib/adapters/registry'

interface ConnectionState {
  id: string
  adapterType: string
  name: string
  status: string
}

interface SchemaObjectLite {
  id: string
  apiName: string
  label: string
  isCustom: boolean
}

export function SourceConnectionPage({ planId }: { planId: string }) {
  const router = useRouter()
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [objects, setObjects] = useState<SchemaObjectLite[]>([])
  const [fetchingSchema, setFetchingSchema] = useState(false)
  const [schemaReady, setSchemaReady] = useState(false)

  const loadSchemaAndObjects = useCallback(async () => {
    const schemaRes = await fetch(`/api/plans/${planId}/source/schema`)
    const schema = await schemaRes.json()
    if (schema) {
      const objRes = await fetch(`/api/plans/${planId}/source/objects`)
      const objs = await objRes.json()
      // /source/objects returns { objects, summary } (009); tolerate a bare array too.
      setObjects(Array.isArray(objs) ? objs : (objs.objects ?? []))
      setSchemaReady(true) // set last so the empty-state never flashes during load
    } else {
      // Connected but no snapshot yet (e.g. just back from OAuth) — fetch schema automatically
      // (refresh strategy: auto on first connection; manual "Refresh Schema" re-fetches later).
      await handleFetchSchema()
    }
  }, [planId])

  useEffect(() => {
    fetch(`/api/plans/${planId}/source`)
      .then((r) => r.json())
      .then((data) => {
        setConnection(data)
        if (data) loadSchemaAndObjects()
      })
      .finally(() => setLoading(false))
  }, [planId, loadSchemaAndObjects])

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
    setSchemaReady(false)
  }

  async function handleFetchSchema() {
    setFetchingSchema(true)
    try {
      const res = await fetch(`/api/plans/${planId}/source/schema`, { method: 'POST' })
      if (res.ok) {
        const objRes = await fetch(`/api/plans/${planId}/source/objects`)
        const objsData = await objRes.json()
        setObjects(Array.isArray(objsData) ? objsData : (objsData.objects ?? []))
        setSchemaReady(true)
      }
    } finally {
      setFetchingSchema(false)
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  if (!connection) {
    const adapterTypes = listAdapterTypes()
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Select a source adapter to connect:</p>
        <div className="grid gap-3 max-w-md">
          {adapterTypes
            .filter((type) => type !== 'hubspot') // HubSpot is destination-only
            .map((type) => (
              <Button
                key={type}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => {
                  if (type === 'salesforce') {
                    // OAuth2 + PKCE: redirect to the auth route which redirects to Salesforce login.
                    window.location.href = `/api/connectors/salesforce/auth?planId=${planId}`
                  } else {
                    handleConnect(type)
                  }
                }}
                disabled={connecting}
              >
                <span className="font-medium capitalize">{type}</span>
                <span className="ml-2 text-muted-foreground text-sm">
                  {type === 'demo'
                    ? '(Mock data for testing)'
                    : type === 'salesforce'
                      ? '(OAuth — login Salesforce)'
                      : ''}
                </span>
              </Button>
            ))}
        </div>
      </div>
    )
  }

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
        <Card className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">✓ {objects.length} objects discovered</p>
            <p className="text-sm text-muted-foreground">
              Choose which objects to migrate — with search and system-object filtering.
            </p>
          </div>
          <Button onClick={() => router.push(`/plans/${planId}/source/objects`)}>
            Continue to object selection →
          </Button>
        </Card>
      )}

      {schemaReady && objects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No objects found. Try &ldquo;Refresh Schema&rdquo;.
        </p>
      )}
    </div>
  )
}
