// 011-object-mapping — SVG bezier link between source and destination object cards

'use client'

interface ObjectLinkProps {
  sourceY: number
  destY: number
  containerWidth: number
  mappingId: string
  onDelete?: (mappingId: string) => void
}

export function ObjectLink({ sourceY, destY, containerWidth, mappingId, onDelete }: ObjectLinkProps) {
  const x1 = 0
  const x2 = containerWidth
  const midX = containerWidth / 2

  // Bezier control points for a smooth curve
  const path = `M ${x1} ${sourceY} C ${x1 + midX * 0.6} ${sourceY}, ${x2 - midX * 0.6} ${destY}, ${x2} ${destY}`

  const midY = (sourceY + destY) / 2

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeOpacity={0.6}
        strokeDasharray="none"
      />
      {/* Interactive midpoint for delete */}
      {onDelete && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="cursor-pointer"
          onClick={() => onDelete(mappingId)}
          role="button"
          aria-label="Remove mapping"
        >
          <circle r={8} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={1} />
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
