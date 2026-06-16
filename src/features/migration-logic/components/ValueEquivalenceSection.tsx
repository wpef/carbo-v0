// 013-migration-logic — D1: Value equivalence section (picklist→picklist / boolean→picklist)
// Click-click linking between source and destination picklist values.
// SVG bezier curves for linked pairs. Auto-links case-insensitive exact matches on mount.
// Ported from v3 src/components/mapping/ValueEquivalenceSection.tsx

'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'

interface EquivPair {
  sourceValue: string
  destinationValue: string
}

interface ItemPosition {
  value: string
  centerY: number
}

interface ValueEquivalenceSectionProps {
  sourceValues: string[]
  destinationValues: string[]
  initialEquivalences: EquivPair[]
  onChange: (equivalences: EquivPair[]) => void
}

export function ValueEquivalenceSection({
  sourceValues,
  destinationValues,
  initialEquivalences,
  onChange,
}: ValueEquivalenceSectionProps) {
  const [equivalences, setEquivalences] = useState<EquivPair[]>(() => {
    if (initialEquivalences.length > 0) return initialEquivalences
    // Auto-link case-insensitive exact matches (spec 013 FR-005)
    const autoLinked: EquivPair[] = []
    for (const sv of sourceValues) {
      const match = destinationValues.find((dv) => dv.toLowerCase() === sv.toLowerCase())
      if (match) autoLinked.push({ sourceValue: sv, destinationValue: match })
    }
    return autoLinked
  })

  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const sourceColRef = useRef<HTMLDivElement>(null)
  const destColRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [sourcePositions, setSourcePositions] = useState<ItemPosition[]>([])
  const [destPositions, setDestPositions] = useState<ItemPosition[]>([])
  const [svgHeight, setSvgHeight] = useState(200)

  useEffect(() => { onChange(equivalences) }, [equivalences, onChange])

  const updatePositions = useCallback(() => {
    if (!sourceColRef.current || !destColRef.current || !svgRef.current) return
    const svgRect = svgRef.current.getBoundingClientRect()
    setSvgHeight(Math.max(svgRect.height, 100))

    const srcItems = sourceColRef.current.querySelectorAll<HTMLElement>('[data-value]')
    const dstItems = destColRef.current.querySelectorAll<HTMLElement>('[data-value]')

    const srcPos: ItemPosition[] = []
    const dstPos: ItemPosition[] = []
    srcItems.forEach((el) => {
      const rect = el.getBoundingClientRect()
      srcPos.push({ value: el.getAttribute('data-value') ?? '', centerY: rect.top + rect.height / 2 - svgRect.top })
    })
    dstItems.forEach((el) => {
      const rect = el.getBoundingClientRect()
      dstPos.push({ value: el.getAttribute('data-value') ?? '', centerY: rect.top + rect.height / 2 - svgRect.top })
    })
    setSourcePositions(srcPos)
    setDestPositions(dstPos)
  }, [])

  useLayoutEffect(() => {
    updatePositions()
    const observer = new ResizeObserver(updatePositions)
    if (sourceColRef.current) observer.observe(sourceColRef.current)
    if (destColRef.current) observer.observe(destColRef.current)
    return () => observer.disconnect()
  }, [sourceValues, destinationValues, equivalences, updatePositions])

  const handleSourceClick = useCallback((value: string) => {
    setSelectedSource((prev) => (prev === value ? null : value))
  }, [])

  const handleDestClick = useCallback(
    (destValue: string) => {
      if (!selectedSource) return
      setEquivalences((prev) => {
        const filtered = prev.filter((e) => e.sourceValue !== selectedSource)
        return [...filtered, { sourceValue: selectedSource, destinationValue: destValue }]
      })
      setSelectedSource(null)
    },
    [selectedSource],
  )

  const handleRemove = useCallback((sourceValue: string) => {
    setEquivalences((prev) => prev.filter((e) => e.sourceValue !== sourceValue))
  }, [])

  const equivBySrc = new Map(equivalences.map((e) => [e.sourceValue, e.destinationValue]))

  return (
    <div className="space-y-2">
      {selectedSource && (
        <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded px-3 py-1.5">
          Valeur source <strong>&quot;{selectedSource}&quot;</strong> sélectionnée. Cliquez sur une valeur destination pour la lier.{' '}
          <button type="button" className="underline hover:no-underline" onClick={() => setSelectedSource(null)}>
            Annuler
          </button>
        </p>
      )}

      <div className="relative grid grid-cols-[1fr_60px_1fr] gap-0 min-h-[200px]">
        {/* Source column */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valeurs source</p>
          <div ref={sourceColRef} className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {sourceValues.map((val) => {
              const isMapped = equivBySrc.has(val)
              const isSelected = selectedSource === val
              return (
                <div
                  key={val}
                  data-value={val}
                  onClick={() => handleSourceClick(val)}
                  className={[
                    'flex items-center justify-between px-3 py-1.5 rounded border text-sm cursor-pointer select-none',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : isMapped
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  ].join(' ')}
                >
                  <span className="truncate">{val}</span>
                  {isMapped && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(val) }}
                      className="ml-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Supprimer le lien pour ${val}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
            {sourceValues.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Aucune valeur source disponible.</p>
            )}
          </div>
        </div>

        {/* SVG bridge */}
        <div className="relative">
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full overflow-visible pointer-events-none"
            style={{ height: svgHeight }}
          >
            {equivalences.map((e) => {
              const srcPos = sourcePositions.find((p) => p.value === e.sourceValue)
              const dstPos = destPositions.find((p) => p.value === e.destinationValue)
              if (!srcPos || !dstPos) return null
              const path = `M 0 ${srcPos.centerY} C 21 ${srcPos.centerY}, 39 ${dstPos.centerY}, 60 ${dstPos.centerY}`
              return (
                <path key={e.sourceValue} d={path} fill="none" stroke="#22c55e" strokeWidth={2} strokeOpacity={0.8} />
              )
            })}
          </svg>
        </div>

        {/* Destination column */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valeurs destination</p>
          <div ref={destColRef} className="space-y-1 max-h-72 overflow-y-auto pl-1">
            {destinationValues.map((val) => {
              const isMappedTo = equivalences.some((e) => e.destinationValue === val)
              return (
                <div
                  key={val}
                  data-value={val}
                  onClick={() => handleDestClick(val)}
                  className={[
                    'px-3 py-1.5 rounded border text-sm select-none',
                    selectedSource ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30' : 'cursor-default',
                    isMappedTo ? 'border-green-300 bg-green-50 text-green-800' : 'border-border',
                  ].join(' ')}
                >
                  <span className="truncate">{val}</span>
                </div>
              )
            })}
            {destinationValues.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">Aucune valeur destination disponible.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {equivalences.length} / {sourceValues.length} valeurs liées.
        {sourceValues.length - equivalences.length > 0 && (
          <span className="text-amber-600 ml-1">
            {sourceValues.length - equivalences.length} non liée(s).
          </span>
        )}
      </p>
    </div>
  )
}
