'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ConnectionInfo } from '../types'

// FR-007 / FR-009: fixed header, does not scroll.
// Shows plan name (link), status badge (French), source → destination connectors with dots.

interface PlanHeaderProps {
  planId: string
  name: string
  status: 'DRAFT' | 'READY' | 'BROKEN'
  sourceConnection: ConnectionInfo | null
  destinationConnection: ConnectionInfo | null
}

const STATUS_CONFIG = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' as const },
  READY: { label: 'Prêt', variant: 'default' as const },
  BROKEN: { label: 'Erreur', variant: 'destructive' as const },
}

const ADAPTER_LABELS: Record<string, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  demo: 'Démo',
  'demo-destination': 'Démo Dest.',
}

function ConnectorDot({ conn }: { conn: ConnectionInfo | null }) {
  if (!conn) {
    return <span className="text-muted-foreground/40 text-xs">Non configuré</span>
  }
  const isConnected = conn.status === 'CONNECTED'
  const label = ADAPTER_LABELS[conn.adapterType] ?? conn.adapterType
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
        aria-label={isConnected ? 'Connecté' : 'Non connecté'}
      />
      {label}
    </span>
  )
}

export function PlanHeader({ planId, name, status, sourceConnection, destinationConnection }: PlanHeaderProps) {
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  return (
    <header className="h-14 border-b flex items-center px-4 gap-3 shrink-0 bg-background">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground shrink-0">
        &larr; Plans
      </Link>
      <div className="h-4 w-px bg-border shrink-0" />
      <Link
        href={`/plans/${planId}`}
        className="text-sm font-medium hover:text-foreground transition-colors truncate"
      >
        {name}
      </Link>
      <Badge variant={statusCfg.variant} className="shrink-0">
        {statusCfg.label}
      </Badge>
      {/* Connector info — pushed to the right */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <ConnectorDot conn={sourceConnection} />
        <span className="text-muted-foreground/30 text-xs">&rarr;</span>
        <ConnectorDot conn={destinationConnection} />
      </div>
    </header>
  )
}
