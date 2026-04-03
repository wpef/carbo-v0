'use client'

// 006-destination-connection — Connection Status Component

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

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

interface ConnectionStatusProps {
  connection: DestinationConnection
  onDisconnect: () => Promise<void>
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADAPTER_LABELS: Record<string, string> = {
  'demo-destination': 'Demo Destination',
  hubspot: 'HubSpot',
}

function getAdapterLabel(type: string): string {
  return ADAPTER_LABELS[type] ?? type
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CONNECTED') {
    return <Badge variant="default">Connected</Badge>
  }
  if (status === 'EXPIRED') {
    return <Badge variant="outline">Expired</Badge>
  }
  if (status === 'ERROR') {
    return <Badge variant="destructive">Error</Badge>
  }
  return <Badge variant="secondary">{status}</Badge>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectionStatus({ connection, onDisconnect, isLoading }: ConnectionStatusProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleConfirmDisconnect() {
    await onDisconnect()
    setDialogOpen(false)
  }

  const connectedDate = connection.connectedAt
    ? new Date(connection.connectedAt).toLocaleString()
    : new Date(connection.createdAt).toLocaleString()

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{getAdapterLabel(connection.adapterType)}</span>
            <StatusBadge status={connection.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            Connected on {connectedDate}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            ID: {connection.id}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="destructive" size="sm" disabled={isLoading} />
            }
          >
            Disconnect
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect destination?</DialogTitle>
              <DialogDescription>
                This will remove the <strong>{getAdapterLabel(connection.adapterType)}</strong> destination
                connection from this plan. Any retrieved schema data (objects, fields) will also be deleted.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" />}
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleConfirmDisconnect}
                disabled={isLoading}
              >
                {isLoading ? 'Disconnecting...' : 'Yes, disconnect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
