// 012-field-mapping — SVG bezier link between source and destination field cards
// 013-migration-logic — Extended with click-to-open migration logic modal

'use client'

import type { LinkStatus } from '@/lib/types/field-mapping'

interface FieldLinkProps {
  x1: number
  y1: number
  x2: number
  y2: number
  fieldMappingId: string
  linkStatus: LinkStatus
  onDelete?: (fieldMappingId: string) => void
  onOpenMigrationLogic?: (fieldMappingId: string) => void
}

// Colour mapping for each link status
const STATUS_COLORS: Record<LinkStatus, string> = {
  GREEN: '#22c55e',
  GREEN_PARTIAL: '#f59e0b',
  RED_SOLID: '#ef4444',
  RED_DASHED: '#ef4444',
  BROKEN: '#b91c1c', // darker red — broken mapping (017)
}

export function FieldLink({
  x1,
  y1,
  x2,
  y2,
  fieldMappingId,
  linkStatus,
  onDelete,
  onOpenMigrationLogic,
}: FieldLinkProps) {
  const dx = x2 - x1
  const cpOffset = Math.abs(dx) * 0.4

  const path = `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  const stroke = STATUS_COLORS[linkStatus]
  const strokeDasharray = linkStatus === 'RED_DASHED' ? '5 3' : undefined

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
              <circle r={7} fill="var(--background)" stroke={stroke} strokeWidth={1.5} />
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
              <circle r={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="var(--muted-foreground)"
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
