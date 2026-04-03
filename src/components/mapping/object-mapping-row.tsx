// 011-object-mapping — Single mapping row with delete button and field mapping link

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ObjectMappingDTO } from '@/lib/types/mapping'

interface ObjectMappingRowProps {
  mapping: ObjectMappingDTO
  planId: string
  onDelete: (mappingId: string) => void
  deleting?: boolean
}

export function ObjectMappingRow({ mapping, planId, onDelete, deleting }: ObjectMappingRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      {/* Source */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{mapping.sourceObjectLabel}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{mapping.sourceObjectApiName}</span>
      </div>

      {/* Arrow */}
      <span className="text-muted-foreground text-sm shrink-0">&#8594;</span>

      {/* Destination */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{mapping.destObjectLabel}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{mapping.destObjectApiName}</span>
      </div>

      {/* Status badge */}
      <Badge
        variant={mapping.status === 'BROKEN' ? 'destructive' : 'secondary'}
        className="shrink-0"
      >
        {mapping.status}
      </Badge>

      {/* Map fields link */}
      <Link
        href={`/plans/${planId}/mapping/${mapping.id}`}
        className="shrink-0 text-xs text-primary hover:underline whitespace-nowrap"
      >
        Map fields
      </Link>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(mapping.id)}
        disabled={deleting}
        aria-label="Remove mapping"
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        ×
      </Button>
    </div>
  )
}
