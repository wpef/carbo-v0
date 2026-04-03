// 013-migration-logic — D1: Value equivalence section (picklist-to-picklist)
// Click-click linking between source and destination picklist values.
// SVG lines for linked pairs. Auto-links case-insensitive exact matches on mount.

'use client'

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import type { ValueEquivalenceDTO } from '@/lib/types/mapping'

interface ValueEquivalenceSectionProps {
  /** Source picklist values (strings) */
  sourceValues: string[]
  /** Destination picklist values (strings) */
  destinationValues: string[]
  /** Initial equivalences loaded from server */
  initialEquivalences: ValueEquivalenceDTO[]
  /** Called when equivalences change (parent tracks current state) */
  onChange: (equivalences: Array<{ sourceValue: string; destinationValue: string }>) => void
}

interface EquivPair {
  sourceValue: string
  destinationValue: string
}

interface ItemPosition {
  value: string
  centerY: number
}

export function ValueEquivalenceSection({
  sourceValues,
  destinationValues,
  initialEquivalences,
  onChange,
}: ValueEquivalenceSectionProps) {
  // Build initial equivalences from props
  const [equivalences, setEquivalences] = useState<EquivPair[]>(() => {
    if (initialEquivalences.length > 0) {
      return initialEquivalences.map((e) => ({
        sourceValue: e.sourceValue,
        destinationValue: e.destinationValue,
      }))
    }
    // Auto-link case-insensitive exact matches
    const autoLinked: EquivPair[] = []
    for (const sv of sourceValues) {
      const match = destinationValues.find((dv) => dv.toLowerCase() === sv.toLowerCase())
      if (match) {
        autoLinked.push({ sourceValue: sv, destinationValue: match })
      }
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

  // Notify parent when equivalences change
  useEffect(() => {
    onChange(equivalences)
  }, [equivalences, onChange])

  // Measure item positions for SVG line drawing
  const updatePositions = useCallback(() => {
    if (!sourceColRef.current || !destColRef.current || !svgRef.current) return

    const svgRect = svgRef.current.getBoundingClientRect()
    setSvgHeight(Math.max(svgRect.height, 100))

    const srcItems = sourceColRef.current.querySelectorAll<HTMLElement>('[data-value]')
    const dstItems = destColRef.current.querySelectorAll<HTMLElement>('[data-value]')

    const srcPositions: ItemPosition[] = []
    const dstPositions: ItemPosition[] = []

    srcItems.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const value = el.getAttribute('data-value') ?? ''
      srcPositions.push({ value, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    dstItems.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const value = el.getAttribute('data-value') ?? ''
      dstPositions.push({ value, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    setSourcePositions(srcPositions)
    setDestPositions(dstPositions)
  }, [])

  useLayoutEffect(() => {
    updatePositions()
    // Re-measure on resize
    const observer = new ResizeObserver(updatePositions)
    if (sourceColRef.current) observer.observe(sourceColRef.current)
    if (destColRef.current) observer.observe(destColRef.current)
    return () => observer.disconnect()
  }, [sourceValues, destinationValues, equivalences, updatePositions])

  // --- Interaction handlers ---

  const handleSourceClick = useCallback((value: string) => {
    setSelectedSource((prev) => (prev === value ? null : value))
  }, [])

  const handleDestClick = useCallback(
    (destValue: string) => {
      if (!selectedSource) return

      setEquivalences((prev) => {
        // Remove any existing mapping for this source value
        const filtered = prev.filter((e) => e.sourceValue !== selectedSource)
        return [...filtered, { sourceValue: selectedSource, destinationValue: destValue }]
      })
      setSelectedSource(null)
    },
    [selectedSource],
  )

  const handleRemoveEquivalence = useCallback((sourceValue: string) => {
    setEquivalences((prev) => prev.filter((e) => e.sourceValue !== sourceValue))
  }, [])

  // Build a lookup for quick access
  const equivBySrc = new Map(equivalences.map((e) => [e.sourceValue, e.destinationValue]))

  return (
    <div className="space-y-2">
      {selectedSource && (
        <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded px-3 py-1.5">
          Source value <strong>&quot;{selectedSource}&quot;</strong> selected. Click a destination value to link it.{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => setSelectedSource(null)}
          >
            Cancel
          </button>
        </p>
      )}

      <div className="relative grid grid-cols-[1fr_60px_1fr] gap-0 min-h-[200px]">
        {/* Source column */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Source values</p>
          <div
            ref={sourceColRef}
            className="space-y-1 max-h-80 overflow-y-auto pr-1"
          >
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
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveEquivalence(val)
                      }}
                      className="ml-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
                      aria-label={`Remove mapping for ${val}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
            {sourceValues.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No source values available.</p>
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
              const x1 = 0
              const x2 = 60
              const midX = 30
              const path = `M ${x1} ${srcPos.centerY} C ${midX * 0.7} ${srcPos.centerY}, ${x2 - midX * 0.7} ${dstPos.centerY}, ${x2} ${dstPos.centerY}`
              return (
                <path
                  key={e.sourceValue}
                  d={path}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeOpacity={0.8}
                />
              )
            })}
          </svg>
        </div>

        {/* Destination column */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Destination values
          </p>
          <div
            ref={destColRef}
            className="space-y-1 max-h-80 overflow-y-auto pl-1"
          >
            {destinationValues.map((val) => {
              const isMappedTo = equivalences.some((e) => e.destinationValue === val)
              return (
                <div
                  key={val}
                  data-value={val}
                  onClick={() => handleDestClick(val)}
                  className={[
                    'px-3 py-1.5 rounded border text-sm select-none',
                    selectedSource
                      ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30'
                      : 'cursor-default',
                    isMappedTo ? 'border-green-300 bg-green-50 text-green-800' : 'border-border',
                  ].join(' ')}
                >
                  <span className="truncate">{val}</span>
                </div>
              )
            })}
            {destinationValues.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No destination values available.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {equivalences.length} of {sourceValues.length} source values linked.
        {sourceValues.length - equivalences.length > 0 && (
          <span className="text-amber-600 ml-1">
            {sourceValues.length - equivalences.length} unlinked.
          </span>
        )}
      </p>
    </div>
  )
}
