// 005-source-field-retrieval / 008-destination-field-retrieval — Accordion of objects with fields

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FieldTable } from './field-table'
import { Badge } from '@/components/ui/badge'
import type { ObjectFieldResult, FieldRetrievalItemResult } from '@/features/schema/hooks/use-fields'

interface ObjectWithFields {
  objectApiName: string
  objectLabel: string
  fields: ObjectFieldResult[]
  fieldCount: number
}

interface ObjectFieldAccordionProps {
  objects: ObjectWithFields[]
  failedObjects?: FieldRetrievalItemResult[]
  onRetry?: (objectApiName: string) => void
  /** When provided, each object shows a "Preview records" link to /{side}/preview/{object}. */
  planId?: string
  side?: 'source' | 'destination'
}

interface AccordionItemProps {
  obj: ObjectWithFields
  failedError?: string
  onRetry?: () => void
  previewHref?: string
}

function AccordionItem({ obj, failedError, onRetry, previewHref }: AccordionItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b last:border-0">
      <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="font-medium text-sm truncate">{obj.objectLabel}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">{obj.objectApiName}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {previewHref && !failedError && (
            <Link
              href={previewHref}
              className="text-xs border rounded px-2 py-1 hover:bg-muted transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Preview records
            </Link>
          )}
          {failedError ? (
            <Badge variant="destructive">Error</Badge>
          ) : (
            <Badge variant="secondary">{obj.fieldCount} fields</Badge>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="text-muted-foreground text-xs"
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {failedError ? (
            <div className="rounded bg-destructive/10 border border-destructive/20 px-3 py-2 flex items-start justify-between gap-3">
              <p className="text-sm text-destructive">{failedError}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="shrink-0 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors"
                >
                  Retry
                </button>
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

export function ObjectFieldAccordion({
  objects,
  failedObjects = [],
  onRetry,
  planId,
  side,
}: ObjectFieldAccordionProps) {
  const failedMap = new Map(failedObjects.filter((f) => !!f.error).map((f) => [f.objectApiName, f.error!]))

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
          key={obj.objectApiName}
          obj={obj}
          failedError={failedMap.get(obj.objectApiName)}
          onRetry={onRetry ? () => onRetry(obj.objectApiName) : undefined}
          previewHref={planId && side ? `/plans/${planId}/${side}/preview/${obj.objectApiName}` : undefined}
        />
      ))}
      {/* Show failed objects that have no data at all */}
      {failedObjects
        .filter((f) => !!f.error && !objects.find((o) => o.objectApiName === f.objectApiName))
        .map((f) => (
          <div key={f.objectApiName} className="border-b last:border-0 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{f.objectApiName}</span>
              <Badge variant="destructive">Error</Badge>
            </div>
            <p className="text-sm text-destructive mt-1">{f.error}</p>
            {onRetry && (
              <button
                type="button"
                className="mt-2 text-xs border rounded px-2 py-1 hover:bg-muted transition-colors"
                onClick={() => onRetry(f.objectApiName)}
              >
                Retry
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
