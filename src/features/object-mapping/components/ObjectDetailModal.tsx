// 011-object-mapping — T014: A3 object detail modal
// Opens when a consultant clicks an object card. Shows: name, role, record count,
// fields to validate (clickable → field-mapping), migration filter count.
// Uses AlertDialog (no Dialog primitive available in v4 component set).

'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'

interface ObjectDetailModalProps {
  open: boolean
  onClose: () => void
  objectApiName: string
  objectLabel: string
  role: 'source' | 'destination'
  /** null while loading */
  recordCount: number | null
  fieldsToValidate: number
  totalFields: number
  migrationFilterCount: number
  /** Navigate to field-mapping for this object */
  onNavigateToFieldMapping: () => void
}

export function ObjectDetailModal({
  open,
  onClose,
  objectApiName,
  objectLabel,
  role,
  recordCount,
  fieldsToValidate,
  totalFields,
  migrationFilterCount,
  onNavigateToFieldMapping,
}: ObjectDetailModalProps) {
  const roleLabel = role === 'source' ? 'Source' : 'Destination'

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg">{objectLabel}</AlertDialogTitle>
          <AlertDialogDescription className="flex items-center gap-2 mt-1">
            <Badge variant={role === 'source' ? 'secondary' : 'outline'}>{roleLabel}</Badge>
            <span className="text-xs text-muted-foreground font-mono">{objectApiName}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          {/* Record count */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Enregistrements</span>
            <span className="text-sm font-medium">
              {recordCount !== null ? recordCount.toLocaleString('fr-FR') : '—'}
            </span>
          </div>

          {/* Fields to validate — clickable (FR-009) */}
          <button
            type="button"
            onClick={onNavigateToFieldMapping}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors group text-left"
          >
            <div>
              <p className="text-sm font-medium">
                {fieldsToValidate} / {totalFields} champs à valider
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Aller au mapping de champs</p>
            </div>
            <svg
              className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Migration filter count */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/20">
            <span className="text-sm text-muted-foreground">Filtres de migration</span>
            <span className="text-sm font-medium">{migrationFilterCount}</span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Fermer</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
