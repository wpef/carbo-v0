'use client'

// 006-destination-connection — Destination Connection Page

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AdapterSelector } from '@/components/destination/adapter-selector'
import { ConnectionStatus } from '@/components/destination/connection-status'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DestinationConnection {
  id: string
  planId: string
  adapterType: string
  status: string
  connectedAt: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DestinationConnectionPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const [connection, setConnection] = useState<DestinationConnection | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Fetch current connection status on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchConnectionStatus()
  }, [planId])

  async function fetchConnectionStatus() {
    setLoadingStatus(true)
    setError(null)
    try {
      const res = await fetch(`/api/plans/${planId}/destination-connection`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setConnection(data.connection)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connection status')
    } finally {
      setLoadingStatus(false)
    }
  }

  // -------------------------------------------------------------------------
  // Connect handler
  // -------------------------------------------------------------------------
  async function handleConnect(adapterType: string, config: Record<string, string>) {
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/plans/${planId}/destination-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterType, config }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setConnection(data.connection)
      setSuccessMessage(
        `Destination connected successfully. Next step: retrieve the destination schema.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setActionLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Disconnect handler
  // -------------------------------------------------------------------------
  async function handleDisconnect() {
    setActionLoading(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch(`/api/plans/${planId}/destination-connection`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setConnection(null)
      setSuccessMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed')
    } finally {
      setActionLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loadingStatus) {
    return (
      <main className="max-w-2xl mx-auto p-8">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href={`/plans/${planId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Destination Connection</h1>
        <p className="text-muted-foreground mt-1">
          Connect the system where migrated data will be written.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {successMessage && !error && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {successMessage}
        </div>
      )}

      {connection ? (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Current Connection
          </h2>
          <ConnectionStatus
            connection={connection}
            onDisconnect={handleDisconnect}
            isLoading={actionLoading}
          />
          {successMessage && (
            <div className="flex justify-end">
              <Link
                href={`/plans/${planId}`}
                className="text-sm text-primary hover:underline"
              >
                Back to plan overview &rarr;
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Choose Adapter
          </h2>
          <AdapterSelector onConnect={handleConnect} isLoading={actionLoading} />
        </div>
      )}
    </main>
  )
}
