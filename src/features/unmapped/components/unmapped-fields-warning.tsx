// 016-unmapped-fields-detection — Collapsible warning panel (v4 port of v3 component)
// Shows unmapped source fields (red/amber) and unmapped required dest fields (red).
// Renders nothing when everything is fully mapped.

'use client'

import { useState } from 'react'
import type { UnmappedFieldsReport, FieldInfo } from '../lib/compute-unmapped'

// ─── FieldRow ──────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: FieldInfo
  side: 'source' | 'dest'
  onExclude?: (apiName: string) => void
}

function FieldRow({ field, side, onExclude }: FieldRowProps) {
  const isRequired = field.isRequired
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded text-sm">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono ${
          isRequired
            ? 'bg-red-100 text-red-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        {field.dataType}
      </span>
      <span className="font-medium text-foreground">{field.label}</span>
      <span className="text-muted-foreground text-xs">({field.apiName})</span>
      {isRequired && <span className="ml-auto shrink-0 text-xs text-red-600 font-medium">Required</span>}
      {side === 'source' && !isRequired && onExclude && (
        <button
          type="button"
          onClick={() => onExclude(field.apiName)}
          className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-destructive"
          title="Exclude this field from migration"
        >
          Exclure
        </button>
      )}
    </div>
  )
}

// ─── SummaryBadge ──────────────────────────────────────────────────────────────

interface SummaryBadgeProps {
  report: UnmappedFieldsReport
}

/**
 * Compact badge showing unmapped counts.
 * Usage: <UnmappedFieldsBadge report={...} />
 */
export function UnmappedFieldsBadge({ report }: SummaryBadgeProps) {
  const remaining = report.fieldsRemainingToValidate
  if (remaining === 0) return null

  const hasRequired =
    report.unmappedSourceFields.some((f) => f.isRequired) ||
    report.unmappedRequiredDestFields.length > 0

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
        hasRequired
          ? 'bg-red-100 text-red-700 border-red-200'
          : 'bg-amber-100 text-amber-700 border-amber-200'
      }`}
    >
      {remaining} champ{remaining !== 1 ? 's' : ''} non-mappé{remaining !== 1 ? 's' : ''}
    </span>
  )
}

// ─── UnmappedFieldsWarning ─────────────────────────────────────────────────────

interface UnmappedFieldsWarningProps {
  report: UnmappedFieldsReport
  /** Called when user clicks "Exclure" on a source field */
  onExcludeField?: (sourceFieldName: string) => void
  /** Called when user clicks "Réinclure" on an excluded field */
  onIncludeField?: (exclusionId: string) => void
}

/**
 * Collapsible warning panel for unmapped fields.
 *
 * - Required unmapped source fields: red
 * - Optional unmapped source fields: amber
 * - Required dest fields not targeted: red
 * - Excluded fields listed with re-include option
 * - Renders nothing when fully mapped (isComplete=true)
 */
export function UnmappedFieldsWarning({ report, onExcludeField, onIncludeField }: UnmappedFieldsWarningProps) {
  const [open, setOpen] = useState(true)

  const hasSourceWarnings = report.unmappedSourceFields.length > 0
  const hasDestWarnings = report.unmappedRequiredDestFields.length > 0
  const hasExclusions = report.excludedSourceFields.length > 0

  if (!hasSourceWarnings && !hasDestWarnings && !hasExclusions) return null

  const hasRequired =
    report.unmappedSourceFields.some((f) => f.isRequired) ||
    report.unmappedRequiredDestFields.length > 0

  const borderColor = hasRequired ? 'border-red-200' : 'border-amber-200'
  const bgColor = hasRequired ? 'bg-red-50' : 'bg-amber-50'
  const textColor = hasRequired ? 'text-red-800' : 'text-amber-800'

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${textColor} hover:opacity-80 transition-opacity`}
      >
        <span className="shrink-0">{open ? '▼' : '▶'}</span>
        <span>Champs non mappés</span>
        <span className="ml-auto text-xs font-normal opacity-70">
          {report.sourceCoverage}% source · {report.destinationRequiredCoverage}% dest. requis
        </span>
      </button>

      {open && (
        <div className="border-t border-inherit divide-y divide-inherit">
          {/* Unmapped source fields */}
          {hasSourceWarnings && (
            <div className="px-4 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Champs source non mappés ({report.unmappedSourceFields.length})
              </p>
              {report.unmappedSourceFields.map((f) => (
                <FieldRow
                  key={f.apiName}
                  field={f}
                  side="source"
                  onExclude={onExcludeField}
                />
              ))}
            </div>
          )}

          {/* Unmapped required dest fields */}
          {hasDestWarnings && (
            <div className="px-4 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Champs destination requis non ciblés ({report.unmappedRequiredDestFields.length})
              </p>
              {report.unmappedRequiredDestFields.map((f) => (
                <FieldRow key={f.apiName} field={f} side="dest" />
              ))}
            </div>
          )}

          {/* Excluded fields */}
          {hasExclusions && (
            <div className="px-4 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Champs exclus ({report.excludedSourceFields.length})
              </p>
              {report.excludedSourceFields.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{e.sourceFieldName}</span>
                  {e.reason && <span className="text-xs italic opacity-70">— {e.reason}</span>}
                  {onIncludeField && (
                    <button
                      type="button"
                      onClick={() => onIncludeField(e.id)}
                      className="ml-auto text-xs text-primary hover:underline shrink-0"
                    >
                      Réinclure
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
