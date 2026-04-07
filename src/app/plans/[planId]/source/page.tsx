'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdapterPicker } from '@/components/source/AdapterPicker'
import { DemoModeToggle } from '@/components/source/DemoModeToggle'
import { SetupProgress } from '@/components/connection/SetupProgress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConnectionSetup } from '@/hooks/use-connection-setup'
import { useSourceConnection } from '@/hooks/use-source-connection'
import { StepNavigation } from '@/components/plans/step-navigation'
import type { AdapterMetadata } from '@/lib/connectors/registry'

export default function SourceConnectionPage() {
  const params = useParams<{ planId: string }>()
  const router = useRouter()
  const planId = params.planId

  const { connection, loading: connLoading } = useSourceConnection(planId)
  const setup = useConnectionSetup(planId, 'source')

  const [selectedAdapter, setSelectedAdapter] = useState('')
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

    const missing = adapterMeta?.configFields.filter((f) => f.required && !configValues[f.name])
    if (missing && missing.length > 0) {
      setFormError(`Missing required fields: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    const config: Record<string, unknown> = { ...configValues }
    await setup.startSetup(selectedAdapter, config)
  }

  async function handleNext() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'DESTINATION' }),
    })
    router.push(`/plans/${planId}/destination`)
  }

  const isAlreadyConnected = connection?.status === 'CONNECTED' && setup.phase === 'IDLE'
  const showForm = !connLoading && !isAlreadyConnected && setup.phase === 'IDLE'

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Source</h1>
        <p className="text-muted-foreground text-sm">
          Connect to your source system. Schema, objects, and fields will be retrieved automatically.
        </p>
      </div>

      {/* Already connected state */}
      {isAlreadyConnected && (
        <div className="space-y-6">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            Source connected ({connection.adapterType}). Setup already completed.
          </div>
          <div className="flex justify-end">
            <Button onClick={handleNext}>
              Next: Configure Destination &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {connLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {/* Connection form */}
      {showForm && (
        <form onSubmit={handleConnect} className="space-y-6">
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

          <section>
            <AdapterPicker
              role="source"
              onSelect={setSelectedAdapter}
              selectedType={selectedAdapter}
            />
          </section>

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

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          {selectedAdapter && (
            <Button type="submit" disabled={setup.phase !== 'IDLE'}>
              Connect &amp; Setup
            </Button>
          )}
        </form>
      )}

      {/* Setup progress */}
      {setup.phase !== 'IDLE' && (
        <div className="mt-6 space-y-6">
          <SetupProgress
            phase={setup.phase}
            error={setup.error}
            role="source"
            results={setup.results}
          />

          {setup.isComplete && (
            <div className="flex justify-end">
              <Button onClick={handleNext}>
                Next: Configure Destination &rarr;
              </Button>
            </div>
          )}
        </div>
      )}
      <StepNavigation planId={params.planId} currentStep="SOURCE" />
    </main>
  )
}
