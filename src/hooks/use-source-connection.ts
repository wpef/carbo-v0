'use client'

import { useCallback, useEffect, useState } from 'react'

export interface SourceConnectionData {
  id: string | null
  planId?: string
  adapterType?: string
  status: string
  connectedAt?: string | null
}

interface UseSourceConnectionResult {
  connection: SourceConnectionData | null
  loading: boolean
  error: string
  connecting: boolean
  disconnecting: boolean
  connect: (adapterType: string, config: Record<string, unknown>) => Promise<boolean>
  disconnect: () => Promise<boolean>
  refresh: () => void
}

export function useSourceConnection(planId: string): UseSourceConnectionResult {
  const [connection, setConnection] = useState<SourceConnectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchConnection = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/plans/${planId}/source`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? 'Failed to load source connection.')
      }
      const data: SourceConnectionData = await res.json()
      setConnection(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchConnection()
  }, [fetchConnection])

  const connect = useCallback(
    async (adapterType: string, config: Record<string, unknown>): Promise<boolean> => {
      setConnecting(true)
      setError('')
      try {
        const res = await fetch(`/api/plans/${planId}/source`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adapterType, config }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.message ?? 'Connection failed.')
          return false
        }
        setConnection(data as SourceConnectionData)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error.')
        return false
      } finally {
        setConnecting(false)
      }
    },
    [planId],
  )

  const disconnect = useCallback(async (): Promise<boolean> => {
    setDisconnecting(true)
    setError('')
    try {
      const res = await fetch(`/api/plans/${planId}/source`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? 'Disconnect failed.')
        return false
      }
      setConnection({ id: null, status: 'NONE' })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.')
      return false
    } finally {
      setDisconnecting(false)
    }
  }, [planId])

  return {
    connection,
    loading,
    error,
    connecting,
    disconnecting,
    connect,
    disconnect,
    refresh: fetchConnection,
  }
}
