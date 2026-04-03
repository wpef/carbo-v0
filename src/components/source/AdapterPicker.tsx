'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AdapterMetadata } from '@/lib/connectors/registry'

interface AdapterPickerProps {
  role: 'source' | 'destination'
  onSelect: (adapterType: string) => void
  selectedType?: string
}

export function AdapterPicker({ role, onSelect, selectedType }: AdapterPickerProps) {
  const [adapters, setAdapters] = useState<AdapterMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/connectors/registry')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load adapters.')
        return res.json()
      })
      .then((data: { adapters: AdapterMetadata[] }) => {
        setAdapters(data.adapters.filter((a) => a.role === role))
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [role])

  if (loading) return <p className="text-sm text-muted-foreground">Loading adapters...</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {adapters.map((adapter) => {
        const isSelected = adapter.type === selectedType
        return (
          <button
            key={adapter.type}
            type="button"
            onClick={() => onSelect(adapter.type)}
            className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted ${
              isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background'
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              {/* Icon placeholder */}
              <span className="flex size-8 items-center justify-center rounded bg-muted text-lg">
                {adapter.type === 'demo' ? '🎭' : '🔌'}
              </span>
              <span className="font-medium text-sm">{adapter.label}</span>
            </div>
            {adapter.configFields.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No credentials required.</p>
            )}
            {adapter.configFields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Requires: {adapter.configFields.map((f) => f.label).join(', ')}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
