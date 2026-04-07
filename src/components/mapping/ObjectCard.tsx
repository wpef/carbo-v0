// 011-object-mapping — Object card with connection circle for visual linking

'use client'

import { Badge } from '@/components/ui/badge'

interface ObjectCardProps {
  id: string
  apiName: string
  label: string
  isCustom: boolean
  role: 'source' | 'destination'
  isHighlighted?: boolean
  isMapped?: boolean
  onCircleClick?: (objectId: string) => void
  /** Called when clicking the card body (not the circle) — opens detail modal */
  onClick?: (objectId: string) => void
}

export function ObjectCard({
  id,
  apiName,
  label,
  isCustom,
  role,
  isHighlighted = false,
  isMapped = false,
  onCircleClick,
  onClick,
}: ObjectCardProps) {
  const isSource = role === 'source'

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? () => onClick(id) : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(id) } : undefined}
      className={`relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isHighlighted
          ? 'border-primary bg-primary/5'
          : isMapped
            ? 'border-border bg-muted/30 hover:bg-muted/50'
            : 'border-border bg-background hover:bg-muted/20'
      }`}
    >
      {/* Left side: connection circle for destination objects */}
      {!isSource && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCircleClick?.(id) }}
          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
            isMapped
              ? 'border-primary bg-primary'
              : 'border-muted-foreground bg-background hover:border-primary hover:bg-primary/20'
          }`}
          aria-label={`Connect to ${label}`}
        />
      )}

      {/* Object info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{label}</span>
          {isCustom && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Custom
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">{apiName}</span>
      </div>

      {/* Right side: connection circle for source objects */}
      {isSource && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCircleClick?.(id) }}
          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
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
