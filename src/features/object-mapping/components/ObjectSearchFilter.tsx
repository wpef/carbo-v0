// 011-object-mapping — T010: text search + category filter tabs per column
// Spec FR-013: All / Mapped only / Unmapped only / Standard only / Custom only

'use client'

import { Input } from '@/components/ui/input'

export type ObjectFilterCategory = 'all' | 'mapped' | 'unmapped' | 'standard' | 'custom'

const FILTER_OPTIONS: { value: ObjectFilterCategory; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'mapped', label: 'Liés' },
  { value: 'unmapped', label: 'Non liés' },
  { value: 'standard', label: 'Standard' },
  { value: 'custom', label: 'Custom' },
]

interface ObjectSearchFilterProps {
  search: string
  onSearchChange: (value: string) => void
  filter: ObjectFilterCategory
  onFilterChange: (value: ObjectFilterCategory) => void
  placeholder?: string
}

export function ObjectSearchFilter({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  placeholder = 'Rechercher des objets...',
}: ObjectSearchFilterProps) {
  return (
    <div className="space-y-2">
      {/* Text search */}
      <div className="relative">
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pr-7 text-sm h-8"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs leading-none"
            aria-label="Effacer la recherche"
          >
            ×
          </button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onFilterChange(opt.value)}
            className={[
              'text-xs px-2 py-0.5 rounded-full border transition-colors',
              filter === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
