// 005-source-field-retrieval — Accordion of objects with their field tables

'use client'

import { useState } from 'react'
import { FieldTable } from './FieldTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ObjectWithFields, FieldRetrievalResult } from '@/lib/types/field'

interface ObjectFieldAccordionProps {
  objects: ObjectWithFields[]
  failedObjects?: FieldRetrievalResult['failed']
  onRetry?: (objectApiName: string) => void
}

interface AccordionItemProps {
  obj: ObjectWithFields
  failedError?: string
  onRetry?: () => void
}

function AccordionItem({ obj, failedError, onRetry }: AccordionItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{obj.objectLabel}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{obj.objectApiName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {failedError ? (
            <Badge variant="destructive">Error</Badge>
          ) : (
            <Badge variant="secondary">{obj.fieldCount} fields</Badge>
          )}
          <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {failedError ? (
            <div className="rounded bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-start justify-between gap-3">
              <p className="text-sm text-destructive">{failedError}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          ) : (
            <FieldTable fields={obj.fields} />
          )}
        </div>
      )}
    </div>
  )
}

export function ObjectFieldAccordion({ objects, failedObjects = [], onRetry }: ObjectFieldAccordionProps) {
  const failedMap = new Map(failedObjects.map((f) => [f.objectApiName, f.error]))

  if (objects.length === 0 && failedObjects.length === 0) {
    return (
      <div className="rounded-lg border border-border py-10 text-center text-sm text-muted-foreground">
        No objects to display. Retrieve fields first.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {objects.map((obj) => (
        <AccordionItem
          key={obj.objectId}
          obj={obj}
          failedError={failedMap.get(obj.objectApiName)}
          onRetry={onRetry ? () => onRetry(obj.objectApiName) : undefined}
        />
      ))}
      {/* Show failed objects that have no data at all */}
      {failedObjects
        .filter((f) => !objects.find((o) => o.objectApiName === f.objectApiName))
        .map((f) => (
          <div key={f.objectApiName} className="border-b last:border-0 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{f.objectApiName}</span>
              <Badge variant="destructive">Error</Badge>
            </div>
            <p className="text-sm text-destructive mt-1">{f.error}</p>
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => onRetry(f.objectApiName)}>
                Retry
              </Button>
            )}
          </div>
        ))}
    </div>
  )
}
