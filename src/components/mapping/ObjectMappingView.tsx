// 011-object-mapping — Two-column mapping view with SVG overlay for links

'use client'

import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { ObjectCard } from './ObjectCard'
import { ObjectLink } from './ObjectLink'
import { ObjectSearchFilter } from './ObjectSearchFilter'
import { Button } from '@/components/ui/button'
import { LinkState } from '@/lib/types/mapping'
import type { ObjectMappingDTO, UnmappedSourceObject, AvailableDestObject } from '@/lib/types/mapping'

interface ObjectMappingViewProps {
  planId: string
  mappings: ObjectMappingDTO[]
  unmappedObjects: UnmappedSourceObject[]
  destObjects: AvailableDestObject[]
  linkState: LinkState
  selectedSourceObjectId: string | null
  onSelectSource: (objectId: string | null) => void
  onCreateLink: (
    sourceObjectId: string,
    sourceObjectApiName: string,
    destObjectId: string,
    destObjectApiName: string,
  ) => Promise<{ error?: string }>
  onDeleteLink: (mappingId: string) => Promise<{ error?: string }>
  onAutoLink: () => Promise<unknown>
  error?: string
}

// Tracks the rendered card positions for drawing SVG links
interface CardPosition {
  objectId: string
  centerY: number
}

export function ObjectMappingView({
  mappings,
  unmappedObjects,
  destObjects,
  linkState,
  selectedSourceObjectId,
  onSelectSource,
  onCreateLink,
  onDeleteLink,
  onAutoLink,
  error,
}: ObjectMappingViewProps) {
  const [sourceSearch, setSourceSearch] = useState('')
  const [destSearch, setDestSearch] = useState('')
  const [actionError, setActionError] = useState('')
  const [autoLinking, setAutoLinking] = useState(false)

  const sourceColRef = useRef<HTMLDivElement>(null)
  const destColRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const [sourcePositions, setSourcePositions] = useState<CardPosition[]>([])
  const [destPositions, setDestPositions] = useState<CardPosition[]>([])
  const [svgWidth, setSvgWidth] = useState(0)
  const [svgHeight, setSvgHeight] = useState(0)

  // Build full source and dest object lists
  const mappedSourceIds = new Set(mappings.map((m) => m.sourceObjectId))
  const mappedDestIds = new Set(mappings.map((m) => m.destObjectId))

  const allSourceObjects = [
    ...mappings.map((m) => ({
      id: m.sourceObjectId,
      apiName: m.sourceObjectApiName,
      label: m.sourceObjectLabel,
      isCustom: false,
      isMapped: true,
    })),
    ...unmappedObjects.map((o) => ({
      id: o.id,
      apiName: o.apiName,
      label: o.label,
      isCustom: o.isCustom,
      isMapped: false,
    })),
  ]

  const filteredSourceObjects = allSourceObjects.filter(
    (o) =>
      o.label.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      o.apiName.toLowerCase().includes(sourceSearch.toLowerCase()),
  )

  const filteredDestObjects = destObjects.filter(
    (o) =>
      o.label.toLowerCase().includes(destSearch.toLowerCase()) ||
      o.apiName.toLowerCase().includes(destSearch.toLowerCase()),
  )

  // Update card positions for SVG links
  const updatePositions = useCallback(() => {
    if (!sourceColRef.current || !destColRef.current || !svgContainerRef.current) return

    const svgRect = svgContainerRef.current.getBoundingClientRect()
    setSvgWidth(svgRect.width)
    setSvgHeight(Math.max(svgRect.height, 200))

    const sourceCards = sourceColRef.current.querySelectorAll('[data-object-id]')
    const destCards = destColRef.current.querySelectorAll('[data-object-id]')

    const newSourcePositions: CardPosition[] = []
    const newDestPositions: CardPosition[] = []

    sourceCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const objectId = card.getAttribute('data-object-id') ?? ''
      newSourcePositions.push({ objectId, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    destCards.forEach((card) => {
      const rect = card.getBoundingClientRect()
      const objectId = card.getAttribute('data-object-id') ?? ''
      newDestPositions.push({ objectId, centerY: rect.top + rect.height / 2 - svgRect.top })
    })

    setSourcePositions(newSourcePositions)
    setDestPositions(newDestPositions)
  }, [])

  useLayoutEffect(() => {
    updatePositions()
  }, [mappings, unmappedObjects, destObjects, filteredSourceObjects, filteredDestObjects, updatePositions])

  const handleSourceCircleClick = useCallback(
    (objectId: string) => {
      if (linkState === LinkState.SOURCE_SELECTED && selectedSourceObjectId === objectId) {
        // Deselect
        onSelectSource(null)
      } else {
        onSelectSource(objectId)
      }
    },
    [linkState, selectedSourceObjectId, onSelectSource],
  )

  const handleDestCircleClick = useCallback(
    async (destObjectId: string) => {
      if (linkState !== LinkState.SOURCE_SELECTED || !selectedSourceObjectId) return

      const sourceObj = allSourceObjects.find((o) => o.id === selectedSourceObjectId)
      const destObj = destObjects.find((o) => o.id === destObjectId)
      if (!sourceObj || !destObj) return

      setActionError('')
      const result = await onCreateLink(
        selectedSourceObjectId,
        sourceObj.apiName,
        destObjectId,
        destObj.apiName,
      )
      if (result.error) {
        setActionError(result.error)
      }
    },
    [linkState, selectedSourceObjectId, allSourceObjects, destObjects, onCreateLink],
  )

  const handleDeleteLink = useCallback(
    async (mappingId: string) => {
      setActionError('')
      const result = await onDeleteLink(mappingId)
      if (result.error) {
        setActionError(result.error)
      }
    },
    [onDeleteLink],
  )

  const handleAutoLink = useCallback(async () => {
    setAutoLinking(true)
    setActionError('')
    await onAutoLink()
    setAutoLinking(false)
  }, [onAutoLink])

  // Build SVG links data
  const svgLinks = mappings.map((m) => {
    const sourcePos = sourcePositions.find((p) => p.objectId === m.sourceObjectId)
    const destPos = destPositions.find((p) => p.objectId === m.destObjectId)
    if (!sourcePos || !destPos) return null
    return { mappingId: m.id, sourceY: sourcePos.centerY, destY: destPos.centerY }
  }).filter((l): l is NonNullable<typeof l> => l !== null)

  const hasUnmapped = unmappedObjects.length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
          </span>
          {hasUnmapped && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              {unmappedObjects.length} unmapped source object{unmappedObjects.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoLink}
          disabled={autoLinking}
        >
          {autoLinking ? 'Linking...' : 'Auto-link'}
        </Button>
      </div>

      {(error || actionError) && (
        <p className="text-sm text-destructive">{error || actionError}</p>
      )}

      {linkState === LinkState.SOURCE_SELECTED && (
        <p className="text-sm text-primary bg-primary/5 border border-primary/20 rounded px-3 py-2">
          Source object selected. Click a destination object circle to create a link.{' '}
          <button
            type="button"
            onClick={() => onSelectSource(null)}
            className="underline hover:no-underline"
          >
            Cancel
          </button>
        </p>
      )}

      {/* Two-column layout with SVG overlay */}
      <div className="relative" ref={svgContainerRef}>
        <div className="grid grid-cols-[1fr_80px_1fr] gap-0">
          {/* Source column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</h3>
            </div>
            <ObjectSearchFilter
              value={sourceSearch}
              onChange={setSourceSearch}
              placeholder="Filter source objects..."
            />
            <div className="space-y-1 mt-2" ref={sourceColRef}>
              {filteredSourceObjects.map((obj) => (
                <div key={obj.id} data-object-id={obj.id}>
                  <ObjectCard
                    id={obj.id}
                    apiName={obj.apiName}
                    label={obj.label}
                    isCustom={obj.isCustom}
                    role="source"
                    isHighlighted={selectedSourceObjectId === obj.id}
                    isMapped={mappedSourceIds.has(obj.id)}
                    onCircleClick={handleSourceCircleClick}
                  />
                </div>
              ))}
              {filteredSourceObjects.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No objects match your search.</p>
              )}
            </div>
          </div>

          {/* SVG bridge column */}
          <div className="relative">
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              style={{ width: svgWidth || 80, height: svgHeight }}
            >
              {svgLinks.map((link) => (
                <ObjectLink
                  key={link.mappingId}
                  sourceY={link.sourceY}
                  destY={link.destY}
                  containerWidth={svgWidth || 80}
                  mappingId={link.mappingId}
                  onDelete={handleDeleteLink}
                />
              ))}
            </svg>
          </div>

          {/* Destination column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destination</h3>
            </div>
            <ObjectSearchFilter
              value={destSearch}
              onChange={setDestSearch}
              placeholder="Filter destination objects..."
            />
            <div className="space-y-1 mt-2" ref={destColRef}>
              {filteredDestObjects.map((obj) => (
                <div key={obj.id} data-object-id={obj.id}>
                  <ObjectCard
                    id={obj.id}
                    apiName={obj.apiName}
                    label={obj.label}
                    isCustom={obj.isCustom}
                    role="destination"
                    isMapped={mappedDestIds.has(obj.id)}
                    onCircleClick={
                      linkState === LinkState.SOURCE_SELECTED ? handleDestCircleClick : undefined
                    }
                  />
                </div>
              ))}
              {filteredDestObjects.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No objects match your search.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
