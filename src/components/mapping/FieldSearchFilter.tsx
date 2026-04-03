// 012-field-mapping — Search/filter input for field columns

'use client'

import { Input } from '@/components/ui/input'

interface FieldSearchFilterProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function FieldSearchFilter({ value, onChange, placeholder = 'Search fields...' }: FieldSearchFilterProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-8 text-sm h-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
