'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ConnectionStatusProps {
  status: 'NONE' | 'PENDING' | 'CONNECTED' | 'EXPIRED' | 'ERROR'
  adapterType?: string
  connectedAt?: string | null
  onDisconnect?: () => void
  disconnecting?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  NONE: 'Not connected',
  PENDING: 'Connecting…',
  CONNECTED: 'Connected',
  EXPIRED: 'Session expired',
  ERROR: 'Error',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NONE: 'outline',
  PENDING: 'secondary',
  CONNECTED: 'default',
  EXPIRED: 'destructive',
  ERROR: 'destructive',
}

export function ConnectionStatus({ status, adapterType, connectedAt, onDisconnect, disconnecting }: ConnectionStatusProps) {
  const label = STATUS_LABELS[status] ?? status
  const variant = STATUS_VARIANTS[status] ?? 'outline'

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <Badge variant={variant}>{label}</Badge>
        {adapterType && (
          <span className="text-sm text-muted-foreground capitalize">{adapterType}</span>
        )}
        {status === 'CONNECTED' && connectedAt && (
          <span className="text-xs text-muted-foreground">
            Connected {new Date(connectedAt).toLocaleString()}
          </span>
        )}
      </div>
      {status === 'CONNECTED' && onDisconnect && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          disabled={disconnecting}
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      )}
    </div>
  )
}
