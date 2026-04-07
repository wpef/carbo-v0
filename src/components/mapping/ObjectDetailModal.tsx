// A3 — Object Detail Modal: summary dashboard for a mapped object

'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

interface ObjectDetailModalProps {
  open: boolean
  onClose: () => void
  objectName: string
  role: 'source' | 'destination'
  recordCount: number | null
  fieldsToValidate: number
  totalFields: number
  migrationFilterCount: number
  onNavigateToFieldMapping: () => void
}

export function ObjectDetailModal({
  open,
  onClose,
  objectName,
  role,
  recordCount,
  fieldsToValidate,
  totalFields,
  migrationFilterCount,
  onNavigateToFieldMapping,
}: ObjectDetailModalProps) {
  const roleLabel = role === 'source' ? 'Source' : 'Destination'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-lg">{objectName}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={role === 'source' ? 'secondary' : 'outline'}>
              {roleLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Record count */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Records</span>
            <span className="text-sm font-medium">
              {recordCount !== null ? recordCount.toLocaleString() : '—'}
            </span>
          </div>

          {/* Fields to validate — clickable */}
          <button
            type="button"
            onClick={onNavigateToFieldMapping}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors group"
          >
            <div className="text-left">
              <p className="text-sm font-medium">
                {fieldsToValidate} / {totalFields} fields to validate
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Go to field mapping
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>

          {/* Migration filters */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Migration filters</span>
            <span className="text-sm font-medium">{migrationFilterCount}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
