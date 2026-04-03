// 022-schema-write — Create field form component

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Common field data types supported by destination systems
const FIELD_DATA_TYPES = [
  { value: 'string', label: 'Text (string)' },
  { value: 'number', label: 'Number' },
  { value: 'bool', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'enumeration', label: 'Picklist (enumeration)' },
  { value: 'phone', label: 'Phone' },
  { value: 'reference', label: 'Reference (lookup)' },
]

interface DestinationObject {
  apiName: string
  label: string
}

interface CreateFieldFormProps {
  destinationObjects: DestinationObject[]
  onSubmit: (params: {
    objectApiName: string
    apiName: string
    label: string
    dataType: string
    isRequired: boolean
  }) => Promise<void>
  isLoading?: boolean
}

export function CreateFieldForm({ destinationObjects, onSubmit, isLoading = false }: CreateFieldFormProps) {
  const [objectApiName, setObjectApiName] = useState(destinationObjects[0]?.apiName ?? '')
  const [apiName, setApiName] = useState('')
  const [label, setLabel] = useState('')
  const [dataType, setDataType] = useState('string')
  const [isRequired, setIsRequired] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!objectApiName.trim()) {
      setValidationError('Please select a destination object.')
      return
    }
    if (!apiName.trim()) {
      setValidationError('API Name is required.')
      return
    }
    if (!label.trim()) {
      setValidationError('Label is required.')
      return
    }
    if (!dataType.trim()) {
      setValidationError('Data type is required.')
      return
    }

    await onSubmit({
      objectApiName: objectApiName.trim(),
      apiName: apiName.trim(),
      label: label.trim(),
      dataType: dataType.trim(),
      isRequired,
    })

    setApiName('')
    setLabel('')
    setDataType('string')
    setIsRequired(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="field-object" className="text-sm font-medium">
          Destination Object <span className="text-destructive">*</span>
        </label>
        <select
          id="field-object"
          value={objectApiName}
          onChange={(e) => setObjectApiName(e.target.value)}
          disabled={isLoading}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {destinationObjects.length === 0 && (
            <option value="">No objects available</option>
          )}
          {destinationObjects.map((obj) => (
            <option key={obj.apiName} value={obj.apiName}>
              {obj.label} ({obj.apiName})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The object where this new field will be added.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="field-api-name" className="text-sm font-medium">
          API Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="field-api-name"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          placeholder="e.g. custom_field__c"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          The technical identifier for this field.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="field-label" className="text-sm font-medium">
          Label <span className="text-destructive">*</span>
        </label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Custom Field"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="field-data-type" className="text-sm font-medium">
          Data Type <span className="text-destructive">*</span>
        </label>
        <select
          id="field-data-type"
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          disabled={isLoading}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {FIELD_DATA_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="field-required"
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="field-required" className="text-sm font-medium">
          Required field
        </label>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      <Button
        type="submit"
        disabled={isLoading || !objectApiName || !apiName.trim() || !label.trim()}
      >
        {isLoading ? 'Creating...' : 'Create Field'}
      </Button>
    </form>
  )
}
