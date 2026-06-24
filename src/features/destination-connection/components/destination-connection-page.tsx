'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listAdapterTypes } from '@/lib/adapters/registry'
import { SchemaDiffView } from '@/features/schema/components/schema-diff-view'
import type { DriftReport } from '@/features/schema/lib/drift'

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

interface SchemaSnapshot {
  id: string
  objects: SchemaObjectLite[]
}

export function DestinationConnectionPage({ planId }: { planId: string }) {
  const router = useRouter()
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null)
  const [fetchingSchema, setFetchingSchema] = useState(false)
  // 003 FR-006 — diff returned by POST /destination/schema (PREVIOUS → new CURRENT).
  const [diffReport, setDiffReport] = useState<DriftReport | null>(null)

  const loadSchema = useCallback(async () => {
    const schemaRes = await fetch(`/api/plans/${planId}/destination/schema`)
    const schemaData = await schemaRes.json()
    if (schemaData) setSchema(schemaData)
    // Connected but no snapshot yet (e.g. just back from OAuth) — fetch schema automatically.
    else await handleFetchSchema()
  }, [planId])

  useEffect(() => {
    fetch(`/api/plans/${planId}/destination`)
      .then((r) => r.json())
      .then((data) => {
        setConnection(data)
        if (data) loadSchema()
      })
      .finally(() => setLoading(false))
  }, [planId, loadSchema])

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
  }

  async function handleFetchSchema() {
    setFetchingSchema(true)
    try {
      const res = await fetch(`/api/plans/${planId}/destination/schema`, { method: 'POST' })
      if (res.ok) {
        // POST returns { snapshot, driftReport } (003 FR-006). Tolerate an older
        // bare-snapshot shape (objects present at top level) for forward-compat.
        const body = await res.json().catch(() => null)
        const snapshot = body?.snapshot ?? body
        setSchema(snapshot ?? null)
        setDiffReport(body?.driftReport ?? null)
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
        <p className="text-muted-foreground">Select a destination adapter to connect:</p>
        <div className="grid gap-3 max-w-md">
          {adapterTypes
            .filter((type) => type !== 'salesforce') // Salesforce is source-only
            .map((type) => (
              <Button
                key={type}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => {
                  if (type === 'hubspot') {
                    // OAuth2: redirect to the auth route which redirects to HubSpot login.
                    window.location.href = `/api/connectors/hubspot/auth?planId=${planId}`
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
                    : type === 'hubspot'
                      ? '(OAuth — login HubSpot)'
                      : ''}
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
        <Card className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">✓ {objects.length} destination objects discovered</p>
            <p className="text-sm text-muted-foreground">
              Retrieve their fields, then map your source data into them.
            </p>
          </div>
          <Button onClick={() => router.push(`/plans/${planId}/destination/fields`)}>
            Continue to field retrieval →
          </Button>
        </Card>
      )}

      {schema && objects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No objects found. Try &ldquo;Refresh Schema&rdquo;.
        </p>
      )}

      {/* 003 FR-006 — diff since the previous snapshot, shown after a refresh. */}
      {diffReport && diffReport.status === 'drift' && (
        <Card className="p-4 space-y-3">
          <p className="font-medium text-sm">Changes since last retrieval</p>
          <SchemaDiffView report={diffReport} />
        </Card>
      )}
    </div>
  )
}
