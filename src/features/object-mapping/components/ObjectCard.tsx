// 011-object-mapping — A2: Object card with connection circle for visual linking
// Circle is on the right for source, left for destination (spec FR-002).

'use client'

import { Badge } from '@/components/ui/badge'

export interface ObjectCardProps {
  /** Stable identifier used for link state machine (apiName used as id in v4) */
  apiName: string
  label: string
  isCustom: boolean
  role: 'source' | 'destination'
  isHighlighted?: boolean
  isMapped?: boolean
  /** Called when the connection circle is clicked */
  onCircleClick?: (apiName: string) => void
  /** Called when the card body is clicked — opens detail modal */
  onCardClick?: (apiName: string) => void
  /** Drift badge: 'new' = OBJECT_ADDED, 'removed' = OBJECT_REMOVED */
  driftStatus?: 'new' | 'removed'
}

export function ObjectCard({
  apiName,
  label,
  isCustom,
  role,
  isHighlighted = false,
  isMapped = false,
  onCircleClick,
  onCardClick,
  driftStatus,
}: ObjectCardProps) {
  const isSource = role === 'source'
  const isRemoved = driftStatus === 'removed'
  const isNew = driftStatus === 'new'

  const cardClass = [
    'relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors select-none',
    onCardClick ? 'cursor-pointer' : '',
    isRemoved
      ? 'border-destructive border-dashed bg-destructive/5'
      : isHighlighted
        ? 'border-primary bg-primary/5'
        : isNew
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
          : isMapped
            ? 'border-border bg-muted/30 hover:bg-muted/50'
            : 'border-border bg-background hover:bg-muted/20',
  ].join(' ')

  const circleClass = [
    'w-4 h-4 rounded-full border-2 shrink-0 transition-colors',
    onCircleClick ? 'cursor-pointer' : 'cursor-default',
    isHighlighted
      ? 'border-primary bg-primary'
      : isMapped
        ? 'border-primary bg-primary'
        : 'border-muted-foreground bg-background hover:border-primary hover:bg-primary/20',
  ].join(' ')

  return (
    <div
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onClick={onCardClick ? () => onCardClick(apiName) : undefined}
      onKeyDown={
        onCardClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onCardClick(apiName)
            }
          : undefined
      }
      className={cardClass}
      data-api-name={apiName}
    >
      {/* Left circle: destination objects only */}
      {!isSource && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCircleClick?.(apiName)
          }}
          className={circleClass}
          aria-label={`Connect to ${label}`}
        />
      )}

      {/* Object info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{label}</span>
          {isCustom && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Custom
            </Badge>
          )}
          {isNew && (
            <Badge variant="outline" className="text-xs shrink-0 border-emerald-500 text-emerald-700">
              Nouveau
            </Badge>
          )}
          {isRemoved && (
            <Badge variant="outline" className="text-xs shrink-0 border-destructive text-destructive">
              {isSource ? 'Supprimé en source' : 'Supprimé en destination'}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">{apiName}</span>
      </div>

      {/* Right circle: source objects only */}
      {isSource && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCircleClick?.(apiName)
          }}
          className={circleClass}
          aria-label={`Select ${label} as mapping source`}
        />
      )}
    </div>
  )
}
