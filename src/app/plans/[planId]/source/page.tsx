'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AdapterPicker } from '@/components/source/AdapterPicker'
import { ConnectionStatus } from '@/components/source/ConnectionStatus'
import { DemoModeToggle } from '@/components/source/DemoModeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSourceConnection } from '@/hooks/use-source-connection'
import type { AdapterMetadata } from '@/lib/connectors/registry'

export default function SourceConnectionPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { connection, loading, error, connecting, disconnecting, connect, disconnect } = useSourceConnection(planId)

  const [selectedAdapter, setSelectedAdapter] = useState<string>('')
  const [adapterMeta, setAdapterMeta] = useState<AdapterMetadata | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  // Fetch adapter metadata when selection changes
  useEffect(() => {
    if (!selectedAdapter) {
      setAdapterMeta(null)
      setConfigValues({})
      return
    }

    fetch('/api/connectors/registry')
      .then((res) => res.json())
      .then((data: { adapters: AdapterMetadata[] }) => {
        const meta = data.adapters.find((a) => a.type === selectedAdapter) ?? null
        setAdapterMeta(meta)
        setConfigValues({})
      })
      .catch(() => setAdapterMeta(null))
  }, [selectedAdapter])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!selectedAdapter) {
      setFormError('Please select a connector.')
      return
    }

    // Validate required fields
    const missing = adapterMeta?.configFields.filter((f) => f.required && !configValues[f.name])
    if (missing && missing.length > 0) {
      setFormError(`Missing required fields: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    const config: Record<string, unknown> = {}
    for (const key of Object.keys(configValues)) {
      config[key] = configValues[key]
    }

    const success = await connect(selectedAdapter, config)
    if (success) {
      setSelectedAdapter('')
      setAdapterMeta(null)
      setConfigValues({})
    }
  }

  async function handleDisconnect() {
    await disconnect()
    setSelectedAdapter('')
  }

  const isConnected = connection?.status === 'CONNECTED'

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Source Connection</h1>
        <p className="text-muted-foreground text-sm">
          Connect to the system you want to migrate data from.
        </p>
      </div>

      {/* Current status */}
      {loading ? (
        <p className="text-sm text-muted-foreground mb-6">Loading connection status...</p>
      ) : (
        <div className="mb-8">
          <ConnectionStatus
            status={(connection?.status ?? 'NONE') as 'NONE' | 'PENDING' | 'CONNECTED' | 'EXPIRED' | 'ERROR'}
            adapterType={connection?.adapterType}
            connectedAt={connection?.connectedAt}
            onDisconnect={handleDisconnect}
            disconnecting={disconnecting}
          />
        </div>
      )}

      {/* Show connect form only when not connected */}
      {!loading && !isConnected && (
        <form onSubmit={handleConnect} className="space-y-6">
          {/* Demo shortcut */}
          <section>
            <DemoModeToggle
              onSelect={(type) => setSelectedAdapter(type)}
              isSelected={selectedAdapter === 'demo'}
            />
          </section>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground px-2">or choose a connector</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Adapter picker */}
          <section>
            <AdapterPicker
              role="source"
              onSelect={setSelectedAdapter}
              selectedType={selectedAdapter}
            />
          </section>

          {/* Dynamic config fields */}
          {adapterMeta && adapterMeta.configFields.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-medium">Connector Configuration</h2>
              {adapterMeta.configFields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="text-sm font-medium" htmlFor={`field-${field.name}`}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Input
                    id={`field-${field.name}`}
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={configValues[field.name] ?? ''}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.label}
                    required={field.required}
                  />
                </div>
              ))}
            </section>
          )}

          {/* Errors */}
          {(formError || error) && (
            <p className="text-sm text-destructive">{formError || error}</p>
          )}

          {/* Submit */}
          {selectedAdapter && (
            <Button type="submit" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </form>
      )}

      {/* Error from hook when connected */}
      {!loading && isConnected && error && (
        <p className="text-sm text-destructive mt-4">{error}</p>
      )}
    </main>
  )
}
