// 012-field-mapping — SVG bezier link between source and destination field cards

'use client'

import type { LinkStatus } from '@/lib/types/field-mapping'

interface FieldLinkProps {
  sourceY: number
  destY: number
  containerWidth: number
  fieldMappingId: string
  linkStatus: LinkStatus
  onDelete?: (fieldMappingId: string) => void
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
}: FieldLinkProps) {
  const x1 = 0
  const x2 = containerWidth
  const midX = containerWidth / 2

  const path = `M ${x1} ${sourceY} C ${x1 + midX * 0.6} ${sourceY}, ${x2 - midX * 0.6} ${destY}, ${x2} ${destY}`
  const midY = (sourceY + destY) / 2

  const stroke = STATUS_COLORS[linkStatus]
  const strokeDasharray = linkStatus === 'RED_DASHED' ? '5 3' : undefined

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeOpacity={0.7}
        strokeDasharray={strokeDasharray}
      />
      {/* Interactive midpoint for delete */}
      {onDelete && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="cursor-pointer"
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
  )
}
