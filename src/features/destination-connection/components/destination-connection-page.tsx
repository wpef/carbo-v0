'use client'

import { useEffect, useState } from 'react'
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

export function DestinationConnectionPage({ planId }: { planId: string }) {
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    fetch(`/api/plans/${planId}/destination`)
      .then((r) => r.json())
      .then((data) => setConnection(data))
      .finally(() => setLoading(false))
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
      }
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await fetch(`/api/plans/${planId}/destination`, { method: 'DELETE' })
    setConnection(null)
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  if (connection) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{connection.name}</h3>
            <p className="text-sm text-muted-foreground">Adapter: {connection.adapterType}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default">{connection.status}</Badge>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      </Card>
    )
  }

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
