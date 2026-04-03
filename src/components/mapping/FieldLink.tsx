// 012-field-mapping — SVG bezier link between source and destination field cards
// 013-migration-logic — Extended with click-to-open migration logic modal

'use client'

import type { LinkStatus } from '@/lib/types/field-mapping'

interface FieldLinkProps {
  sourceY: number
  destY: number
  containerWidth: number
  fieldMappingId: string
  linkStatus: LinkStatus
  onDelete?: (fieldMappingId: string) => void
  onOpenMigrationLogic?: (fieldMappingId: string) => void
}

// Colour mapping for each link status
const STATUS_COLORS: Record<LinkStatus, string> = {
  GREEN: '#22c55e',
  ORANGE: '#f97316',
  RED_SOLID: '#ef4444',
  RED_DASHED: '#ef4444',
}

export function FieldLink({
  sourceY,
  destY,
  containerWidth,
  fieldMappingId,
  linkStatus,
  onDelete,
  onOpenMigrationLogic,
}: FieldLinkProps) {
  const x1 = 0
  const x2 = containerWidth
  const midX = containerWidth / 2

  const path = `M ${x1} ${sourceY} C ${x1 + midX * 0.6} ${sourceY}, ${x2 - midX * 0.6} ${destY}, ${x2} ${destY}`
  const midY = (sourceY + destY) / 2

  const stroke = STATUS_COLORS[linkStatus]
  const strokeDasharray = linkStatus === 'RED_DASHED' ? '5 3' : undefined

  // Show migration-logic click zone on the path itself
  // and delete button near the midpoint but offset
  const hasActions = onDelete || onOpenMigrationLogic

  return (
    <g>
      {/* Invisible wider path for easier click target */}
      {onOpenMigrationLogic && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          className="cursor-pointer pointer-events-auto"
          onClick={() => onOpenMigrationLogic(fieldMappingId)}
          aria-label="Open migration logic"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeOpacity={0.7}
        strokeDasharray={strokeDasharray}
        className={onOpenMigrationLogic ? 'pointer-events-none' : undefined}
      />
      {/* Interactive midpoint buttons */}
      {hasActions && (
        <g transform={`translate(${midX}, ${midY})`}>
          {/* Open migration logic — left button */}
          {onOpenMigrationLogic && (
            <g
              transform="translate(-10, 0)"
              className="cursor-pointer pointer-events-auto"
              onClick={() => onOpenMigrationLogic(fieldMappingId)}
              role="button"
              aria-label="Open migration logic"
            >
              <circle r={7} fill="hsl(var(--background))" stroke={stroke} strokeWidth={1.5} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fill={stroke}
                className="select-none"
              >
                ✎
              </text>
            </g>
          )}
          {/* Delete — right button */}
          {onDelete && (
            <g
              transform={onOpenMigrationLogic ? 'translate(10, 0)' : 'translate(0, 0)'}
              className="cursor-pointer pointer-events-auto"
              onClick={() => onDelete(fieldMappingId)}
              role="button"
              aria-label="Remove field mapping"
            >
              <circle r={7} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={1} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
                className="select-none"
              >
                ×
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  )
}
