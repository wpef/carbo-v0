// 016-unmapped-fields-detection — Warning panel showing unmapped fields per object mapping

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { UnmappedFieldsReport, UnmappedFieldInfo, ObjectMappingUnmappedReport } from '@/lib/types/unmapped-fields'

// --- Field row ---

interface FieldRowProps {
  field: UnmappedFieldInfo
  side: 'source' | 'dest'
}

function FieldRow({ field, side }: FieldRowProps) {
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
      {isRequired && (
        <span className="ml-auto shrink-0 text-xs text-red-600 font-medium">Required</span>
      )}
      {side === 'dest' && !isRequired && (
        <span className="ml-auto shrink-0 text-xs text-amber-600">Required dest</span>
      )}
    </div>
  )
}

// --- Per-object-mapping collapsible section ---

interface ObjectMappingSectionProps {
  data: ObjectMappingUnmappedReport
}

function ObjectMappingSection({ data }: ObjectMappingSectionProps) {
  const [open, setOpen] = useState(true)

  const hasSourceWarnings = data.unmappedSourceFields.length > 0
  const hasDestWarnings = data.unmappedDestFields.length > 0
  const hasRequired = data.unmappedSourceFields.some((f) => f.isRequired) || data.unmappedDestFields.length > 0

  if (!hasSourceWarnings && !hasDestWarnings) return null

  const headerColor = hasRequired
    ? 'border-red-200 bg-red-50'
    : 'border-amber-200 bg-amber-50'

  const headerTextColor = hasRequired ? 'text-red-800' : 'text-amber-800'

  return (
    <div className={`rounded-lg border ${headerColor} overflow-hidden`}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium ${headerTextColor} hover:opacity-80 transition-opacity`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span>
          {data.sourceObjectApiName} → {data.destObjectApiName}
        </span>
        <span className="ml-auto text-xs font-normal opacity-70">
          {data.mappedCount}/{data.totalSourceFields} source fields mapped
        </span>
      </button>

      {open && (
        <div className="border-t border-inherit divide-y divide-inherit">
          {/* Unmapped source fields */}
          {hasSourceWarnings && (
            <div className="px-4 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Unmapped source fields ({data.unmappedSourceFields.length})
              </p>
              {data.unmappedSourceFields.map((f) => (
                <FieldRow key={f.apiName} field={f} side="source" />
              ))}
            </div>
          )}

          {/* Unmapped required dest fields */}
          {hasDestWarnings && (
            <div className="px-4 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Required destination fields not targeted ({data.unmappedDestFields.length})
              </p>
              {data.unmappedDestFields.map((f) => (
                <FieldRow key={f.apiName} field={f} side="dest" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Main panel ---

interface UnmappedFieldsWarningProps {
  report: UnmappedFieldsReport
}

/**
 * Banner/panel showing unmapped fields per object mapping.
 * - Required unmapped source fields shown in red.
 * - Optional unmapped source fields shown in amber.
 * - Required dest fields not targeted shown in red.
 * - Collapsible per object mapping.
 * Renders nothing if everything is mapped.
 */
export function UnmappedFieldsWarning({ report }: UnmappedFieldsWarningProps) {
  const { summary } = report
  const hasIssues = summary.totalUnmappedSource > 0 || summary.totalUnmappedDest > 0

  if (!hasIssues) return null

  const objectMappingsWithIssues = report.objectMappings.filter(
    (om) => om.unmappedSourceFields.length > 0 || om.unmappedDestFields.length > 0,
  )

  return (
    <div className="space-y-2">
      {/* Plan-level summary header */}
      <div className="flex items-center gap-3 text-sm">
        {summary.totalRequiredUnmapped > 0 && (
          <span className="text-red-700 font-medium">
            {summary.totalRequiredUnmapped} required source field{summary.totalRequiredUnmapped !== 1 ? 's' : ''} unmapped
          </span>
        )}
        {summary.totalUnmappedSource > summary.totalRequiredUnmapped && (
          <span className="text-amber-700">
            {summary.totalUnmappedSource - summary.totalRequiredUnmapped} optional source field
            {summary.totalUnmappedSource - summary.totalRequiredUnmapped !== 1 ? 's' : ''} unmapped
          </span>
        )}
        {summary.totalUnmappedDest > 0 && (
          <span className="text-red-700 font-medium">
            {summary.totalUnmappedDest} required dest field{summary.totalUnmappedDest !== 1 ? 's' : ''} not targeted
          </span>
        )}
      </div>

      {/* Per-object sections */}
      <div className="space-y-2">
        {objectMappingsWithIssues.map((om) => (
          <ObjectMappingSection key={om.objectMappingId} data={om} />
        ))}
      </div>
    </div>
  )
}
