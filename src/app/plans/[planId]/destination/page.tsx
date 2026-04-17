'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AdapterSelector } from '@/components/destination/adapter-selector'
import { SetupProgress } from '@/components/connection/SetupProgress'
import { useConnectionSetup } from '@/hooks/use-connection-setup'

interface DestinationConnection {
  id: string
  planId: string
  adapterType: string
  status: string
  connectedAt: string | null
}

export default function DestinationConnectionPage() {
  const params = useParams<{ planId: string }>()
  const searchParams = useSearchParams()
  const planId = params.planId

  const connectorError = searchParams.get('connector_error')
  const connected = searchParams.get('connected')

  const setup = useConnectionSetup(planId, 'destination')

  const [existingConnection, setExistingConnection] = useState<DestinationConnection | null>(null)
  const [loading, setLoading] = useState(true)

  // Check existing connection
  useEffect(() => {
    fetch(`/api/plans/${planId}/destination-connection`)
      .then((res) => res.json())
      .then((data) => setExistingConnection(data.connection ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  async function handleConnect(adapterType: string, config: Record<string, string>) {
    await setup.startSetup(adapterType, config as Record<string, unknown>)
  }

  const isAlreadyConnected = existingConnection?.status === 'CONNECTED' && setup.phase === 'IDLE'
  const showForm = !loading && !isAlreadyConnected && setup.phase === 'IDLE'

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Destination</h1>
        <p className="text-muted-foreground text-sm">
          Connect to the destination system. Schema and fields will be retrieved automatically.
        </p>
      </div>

      {/* OAuth callback feedback */}
      {connectorError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Connection failed: {connectorError}
        </div>
      )}
      {connected && !connectorError && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Connected to {connected}. You can continue to the next step.
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {isAlreadyConnected && (
        <div className="space-y-6">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            Destination connected ({existingConnection.adapterType}). Setup already completed.
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Choose Adapter
          </h2>
          <AdapterSelector onConnect={handleConnect} isLoading={setup.phase !== 'IDLE'} planId={planId} />
        </div>
      )}

      {setup.phase !== 'IDLE' && (
        <div className="mt-6 space-y-6">
          <SetupProgress
            phase={setup.phase}
            error={setup.error}
            role="destination"
            results={setup.results}
          />

        </div>
      )}
    </main>
  )
}
