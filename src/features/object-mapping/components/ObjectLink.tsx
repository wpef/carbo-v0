// 011-object-mapping — T011: SVG bezier link between source and destination cards
// Session learning #1: use var(--primary) NOT hsl(var(--primary)) — CSS vars already
// contain oklch() values so hsl(oklch(...)) is invalid.

'use client'

interface ObjectLinkProps {
  x1: number
  y1: number
  x2: number
  y2: number
  mappingId: string
  /** When true the link is rendered in a broken/drift style (OBJECT_REMOVED) */
  isBroken?: boolean
  onDelete?: (mappingId: string) => void
}

export function ObjectLink({ x1, y1, x2, y2, mappingId, isBroken = false, onDelete }: ObjectLinkProps) {
  const dx = Math.abs(x2 - x1)
  const cpOffset = dx * 0.45

  const path = `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`

  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={isBroken ? 'var(--destructive)' : 'var(--primary)'}
        strokeWidth={isBroken ? 1.5 : 2}
        strokeOpacity={isBroken ? 0.8 : 0.6}
        strokeDasharray={isBroken ? '5 3' : undefined}
      />
      {/* Interactive midpoint for delete — pointer-events-auto overrides parent none */}
      {onDelete && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="cursor-pointer pointer-events-auto"
          onClick={() => onDelete(mappingId)}
          role="button"
          aria-label="Supprimer ce mapping"
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
