'use client'

// 006-destination-connection — Adapter Selector Component

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Adapter definitions (destination-capable adapters available in Phase 1)
// ---------------------------------------------------------------------------

interface AdapterOption {
  type: string
  label: string
  description: string
  requiresConfig: boolean
  configFields?: { key: string; label: string; placeholder: string; type: string }[]
}

const DESTINATION_ADAPTERS: AdapterOption[] = [
  {
    type: 'demo-destination',
    label: 'Demo Destination',
    description: 'Pre-seeded HubSpot-like data. No credentials required. Use this to explore the full workflow without a real system.',
    requiresConfig: false,
  },
  {
    type: 'hubspot',
    label: 'HubSpot',
    description: 'Connect your HubSpot CRM as the migration destination. Requires a Private App access token.',
    requiresConfig: true,
    configFields: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'pat-na1-...', type: 'password' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdapterSelectorProps {
  onConnect: (adapterType: string, config: Record<string, string>) => Promise<void>
  isLoading: boolean
  planId?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdapterSelector({ onConnect, isLoading, planId }: AdapterSelectorProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})

  const selectedAdapter = DESTINATION_ADAPTERS.find((a) => a.type === selectedType)

  function handleSelect(type: string) {
    setSelectedType(type)
    setConfigValues({})
  }

  function handleConfigChange(key: string, value: string) {
    setConfigValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleConnect() {
    if (!selectedType) return
    await onConnect(selectedType, configValues)
  }

  const canConnect =
    selectedType !== null &&
    (selectedAdapter?.requiresConfig === false ||
      (selectedAdapter?.configFields ?? []).every((f) => configValues[f.key]?.trim()))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the destination system to connect to this migration plan.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {DESTINATION_ADAPTERS.map((adapter) => (
          <button
            key={adapter.type}
            type="button"
            onClick={() => handleSelect(adapter.type)}
            className={`text-left rounded-xl border-2 p-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selectedType === adapter.type
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/50'
            }`}
          >
            <div className="font-medium text-sm">{adapter.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{adapter.description}</div>
            {!adapter.requiresConfig && (
              <span className="mt-2 inline-block text-xs text-primary font-medium">
                No credentials required
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedAdapter?.requiresConfig && selectedAdapter.configFields && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{selectedAdapter.label} Configuration</CardTitle>
            <CardDescription>
              {selectedType === 'hubspot'
                ? 'Paste a Private App token, or use OAuth2 to connect via the browser.'
                : 'Enter your credentials to authenticate.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedAdapter.configFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label htmlFor={field.key} className="text-xs font-medium">
                    {field.label}
                  </label>
                  <input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={configValues[field.key] ?? ''}
                    onChange={(e) => handleConfigChange(field.key, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center gap-2">
        {selectedType === 'hubspot' && planId && (
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = `/api/connectors/hubspot/auth?planId=${encodeURIComponent(planId)}`
            }}
            disabled={isLoading}
          >
            Connect via OAuth2
          </Button>
        )}
        <div className="ml-auto">
          <Button
            onClick={handleConnect}
            disabled={!canConnect || isLoading}
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  )
}
