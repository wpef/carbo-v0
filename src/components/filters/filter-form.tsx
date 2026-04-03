// 015-migration-filters — Form to add a new filter

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FILTER_OPERATORS } from '@/lib/types/filter'
import type { CreateFilterInput, FilterableField, FilterOperator } from '@/lib/types/filter'

interface FilterFormProps {
  filterableFields: FilterableField[]
  onSubmit: (input: CreateFilterInput) => Promise<{ error?: string }>
}

export function FilterForm({ filterableFields, onSubmit }: FilterFormProps) {
  const [fieldApiName, setFieldApiName] = useState('')
  const [operator, setOperator] = useState<FilterOperator>('EQUALS')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const operatorMeta = FILTER_OPERATORS.find((op) => op.value === operator)
  const needsValue = operatorMeta?.needsValue ?? true

  const handleSubmit = async () => {
    if (!fieldApiName || !operator) return
    if (needsValue && !value.trim()) {
      setError('A value is required for this operator.')
      return
    }

    setSubmitting(true)
    setError('')

    const result = await onSubmit({
      fieldApiName,
      operator,
      value: needsValue ? value.trim() : undefined,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      setFieldApiName('')
      setOperator('EQUALS')
      setValue('')
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <h4 className="text-sm font-medium">Add Filter</h4>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Field picker */}
        <select
          value={fieldApiName}
          onChange={(e) => setFieldApiName(e.target.value)}
          className="h-8 flex-1 min-w-[140px] rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          <option value="">Select field...</option>
          {filterableFields.map((f) => (
            <option key={f.apiName} value={f.apiName}>
              {f.label} ({f.apiName})
            </option>
          ))}
        </select>

        {/* Operator picker */}
        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value as FilterOperator)}
          className="h-8 min-w-[140px] rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          {FILTER_OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {/* Value input — hidden for IS_NULL / IS_NOT_NULL */}
        {needsValue && (
          <Input
            type="text"
            placeholder="Value..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 flex-1 min-w-[120px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
          />
        )}

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!fieldApiName || !operator || submitting}
        >
          {submitting ? 'Adding...' : 'Add'}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
