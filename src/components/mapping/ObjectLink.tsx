// 011-object-mapping — SVG bezier link between source and destination object cards

'use client'

interface ObjectLinkProps {
  x1: number
  y1: number
  x2: number
  y2: number
  mappingId: string
  onDelete?: (mappingId: string) => void
}

export function ObjectLink({ x1, y1, x2, y2, mappingId, onDelete }: ObjectLinkProps) {
  const dx = x2 - x1
  const cpOffset = Math.abs(dx) * 0.4

  // Bezier control points for a smooth curve
  const path = `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`

  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeOpacity={0.6}
      />
      {/* Interactive midpoint for delete */}
      {onDelete && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="cursor-pointer pointer-events-auto"
          onClick={() => onDelete(mappingId)}
          role="button"
          aria-label="Remove mapping"
        >
          <circle r={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
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
  )
}
