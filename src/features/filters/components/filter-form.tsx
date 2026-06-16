// 015-migration-filters — Form to add a new filter
// Ported from v3 src/components/filters/filter-form.tsx.
// Adds date input for DATE_AFTER / DATE_BEFORE (spec FR-002 / tasks T013).

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FILTER_OPERATORS, DATE_OPERATORS } from '../lib/filter-operators'
import type { CreateFilterInput, FilterableField, FilterOperator } from '../types'

interface FilterFormProps {
  filterableFields: FilterableField[]
  onSubmit: (input: CreateFilterInput) => Promise<{ error?: string; warning?: string }>
}

export function FilterForm({ filterableFields, onSubmit }: FilterFormProps) {
  const [fieldApiName, setFieldApiName] = useState('')
  const [operator, setOperator] = useState<FilterOperator>('EQUALS')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  const operatorMeta = FILTER_OPERATORS.find((op) => op.value === operator)
  const needsValue = operatorMeta?.needsValue ?? true
  const isDateOperator = DATE_OPERATORS.has(operator)

  const handleSubmit = async () => {
    if (!fieldApiName || !operator) return
    if (needsValue && !value.trim()) {
      setError('Une valeur est requise pour cet opérateur.')
      return
    }

    setSubmitting(true)
    setError('')
    setWarning('')

    const result = await onSubmit({
      fieldApiName,
      operator,
      value: needsValue ? value.trim() : undefined,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else {
      if (result.warning) setWarning(result.warning)
      setFieldApiName('')
      setOperator('EQUALS')
      setValue('')
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <h4 className="text-sm font-medium">Ajouter un filtre</h4>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Field picker */}
        <select
          value={fieldApiName}
          onChange={(e) => setFieldApiName(e.target.value)}
          className="h-8 flex-1 min-w-[140px] rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          <option value="">Sélectionner un champ...</option>
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
          className="h-8 min-w-[160px] rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          {FILTER_OPERATORS.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {/* Value input — date picker for date operators, text otherwise, hidden for IS_NULL */}
        {needsValue && (
          <Input
            type={isDateOperator ? 'date' : 'text'}
            placeholder={isDateOperator ? 'YYYY-MM-DD' : 'Valeur...'}
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
          {submitting ? 'Ajout...' : 'Ajouter'}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {warning && <p className="text-xs text-amber-600">{warning}</p>}
    </div>
  )
}
