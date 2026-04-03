// 012-field-mapping — Field card with connection circle for visual linking

'use client'

import { Badge } from '@/components/ui/badge'

interface FieldCardProps {
  id: string
  apiName: string
  label: string
  dataType: string
  isRequired?: boolean
  role: 'source' | 'destination'
  isHighlighted?: boolean
  isMapped?: boolean
  onCircleClick?: (fieldId: string) => void
}

// Map type strings to a short display label for the badge
function getTypeLabel(dataType: string): string {
  const t = dataType.toLowerCase()
  if (['string', 'text', 'email', 'url', 'phone', 'textarea', 'richtext'].includes(t)) return 'Text'
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'percent'].includes(t)) return 'Number'
  if (['date', 'datetime'].includes(t)) return 'Date'
  if (['picklist', 'multipicklist', 'enum', 'select'].includes(t)) return 'Picklist'
  if (['boolean', 'checkbox'].includes(t)) return 'Boolean'
  return dataType
}

export function FieldCard({
  id,
  apiName,
  label,
  dataType,
  isRequired = false,
  role,
  isHighlighted = false,
  isMapped = false,
  onCircleClick,
}: FieldCardProps) {
  const isSource = role === 'source'

  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
        isHighlighted
          ? 'border-primary bg-primary/5'
          : isMapped
            ? 'border-border bg-muted/30'
            : 'border-border bg-background hover:bg-muted/20'
      }`}
    >
      {/* Left side: connection circle for destination fields */}
      {!isSource && (
        <button
          type="button"
          onClick={() => onCircleClick?.(id)}
          className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
            isMapped
              ? 'border-primary bg-primary'
              : 'border-muted-foreground bg-background hover:border-primary hover:bg-primary/20'
          }`}
          aria-label={`Connect to ${label}`}
        />
      )}

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{label}</span>
          {isRequired && (
            <span className="text-xs text-red-500 shrink-0" title="Required">
              *
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono truncate">{apiName}</span>
          <Badge variant="secondary" className="text-xs shrink-0 py-0 px-1">
            {getTypeLabel(dataType)}
          </Badge>
        </div>
      </div>

      {/* Right side: connection circle for source fields */}
      {isSource && (
        <button
          type="button"
          onClick={() => onCircleClick?.(id)}
          className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
            isHighlighted
              ? 'border-primary bg-primary'
              : isMapped
                ? 'border-primary bg-primary'
                : 'border-muted-foreground bg-background hover:border-primary hover:bg-primary/20'
          }`}
          aria-label={`Select ${label} as mapping source`}
        />
      )}
    </div>
  )
}
