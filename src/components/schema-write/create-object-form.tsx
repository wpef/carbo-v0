// 022-schema-write — Create object form component

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CreateObjectFormProps {
  onSubmit: (apiName: string, label: string) => Promise<void>
  isLoading?: boolean
}

export function CreateObjectForm({ onSubmit, isLoading = false }: CreateObjectFormProps) {
  const [apiName, setApiName] = useState('')
  const [label, setLabel] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!apiName.trim()) {
      setValidationError('API Name is required.')
      return
    }
    if (!label.trim()) {
      setValidationError('Label is required.')
      return
    }

    await onSubmit(apiName.trim(), label.trim())
    setApiName('')
    setLabel('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="object-api-name" className="text-sm font-medium">
          API Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="object-api-name"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          placeholder="e.g. custom_object__c"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          The technical identifier used by the destination system.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="object-label" className="text-sm font-medium">
          Label <span className="text-destructive">*</span>
        </label>
        <Input
          id="object-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Custom Object"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          The human-readable name shown in the destination UI.
        </p>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      <Button type="submit" disabled={isLoading || !apiName.trim() || !label.trim()}>
        {isLoading ? 'Creating...' : 'Create Object'}
      </Button>
    </form>
  )
}
