// 011-object-mapping — T012: hook to compute SVG bezier coordinates from card DOM rects
//
// Session learnings from spec §Session Learnings:
// #2 — useLayoutEffect MUST depend on PRIMITIVE values (search strings, mapping count)
//       NOT on array references (recreated every render → infinite setState loop).
//       A single setSvgLayout() call replaces all separate setState calls.
// #3 — SVG must overlay the FULL container (not the bridge column). Coordinates
//       come from actual bounding rects relative to the container.

import { useRef, useState, useLayoutEffect, useCallback } from 'react'

export interface CardPosition {
  apiName: string
  /** x = rightX for source, leftX for destination */
  x: number
  centerY: number
}

export interface SvgLayout {
  sourcePositions: CardPosition[]
  destPositions: CardPosition[]
  width: number
  height: number
}

const EMPTY_LAYOUT: SvgLayout = { sourcePositions: [], destPositions: [], width: 0, height: 0 }

/**
 * Returns refs to attach to the source column div, destination column div, and the
 * full-width SVG container, plus the computed layout for drawing ObjectLink paths.
 *
 * @param deps - primitive dependency values (search strings, mapping count, filter values)
 *               — MUST be primitive to avoid infinite loops (session learning #2).
 */
export function useSvgLinks(deps: (string | number)[]) {
  const sourceColRef = useRef<HTMLDivElement>(null)
  const destColRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const [svgLayout, setSvgLayout] = useState<SvgLayout>(EMPTY_LAYOUT)

  const updatePositions = useCallback(() => {
    const sourceEl = sourceColRef.current
    const destEl = destColRef.current
    const containerEl = svgContainerRef.current
    if (!sourceEl || !destEl || !containerEl) return

    const containerRect = containerEl.getBoundingClientRect()
    const sourceCards = sourceEl.querySelectorAll<HTMLElement>('[data-api-name]')
    const destCards = destEl.querySelectorAll<HTMLElement>('[data-api-name]')

    const sourcePositions: CardPosition[] = []
    const destPositions: CardPosition[] = []

    sourceCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const apiName = card.getAttribute('data-api-name') ?? ''
      sourcePositions.push({
        apiName,
        // Right edge of source card relative to container
        x: rect.right - containerRect.left,
        centerY: rect.top + rect.height / 2 - containerRect.top,
      })
    })

    destCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const apiName = card.getAttribute('data-api-name') ?? ''
      destPositions.push({
        apiName,
        // Left edge of destination card relative to container
        x: rect.left - containerRect.left,
        centerY: rect.top + rect.height / 2 - containerRect.top,
      })
    })

    // Single setState call — avoids multiple re-renders (session learning #2)
    setSvgLayout({
      sourcePositions,
      destPositions,
      width: containerRect.width,
      height: containerRect.height,
    })
  }, [])

  // Primitive deps only (session learning #2) — spread into the dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    updatePositions()
    // Also re-measure on scroll/resize of the container
    const observer = new ResizeObserver(updatePositions)
    if (svgContainerRef.current) observer.observe(svgContainerRef.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, updatePositions])

  return { sourceColRef, destColRef, svgContainerRef, svgLayout }
}
