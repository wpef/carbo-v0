// 017-mapping-integrity-check — Panel showing integrity report with repair action

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IntegrityReport, BrokenObjectMapping, BrokenFieldMapping, TypeChange } from '@/lib/types/integrity'

// --- Broken object mapping row ---

interface BrokenObjectRowProps {
  item: BrokenObjectMapping
}

function BrokenObjectRow({ item }: BrokenObjectRowProps) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded text-sm bg-red-50 border border-red-100">
      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="font-medium text-red-800">
          {item.sourceObjectApiName} → {item.destObjectApiName}
        </span>
        <p className="text-red-600 text-xs mt-0.5">{item.reason}</p>
      </div>
    </div>
  )
}

// --- Broken field mapping row ---

interface BrokenFieldRowProps {
  item: BrokenFieldMapping
}

function BrokenFieldRow({ item }: BrokenFieldRowProps) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded text-sm bg-red-50 border border-red-100">
      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="font-mono text-xs text-red-800">{item.fieldMappingId.slice(0, 8)}…</span>
        <p className="text-red-600 text-xs mt-0.5">{item.reason}</p>
      </div>
    </div>
  )
}

// --- Type change row ---

interface TypeChangeRowProps {
  item: TypeChange
}

function TypeChangeRow({ item }: TypeChangeRowProps) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded text-sm bg-amber-50 border border-amber-100">
      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="font-medium text-amber-800">{item.field}</span>
        <p className="text-amber-600 text-xs mt-0.5">
          {item.oldType} → {item.newType}
        </p>
      </div>
    </div>
  )
}

// --- Collapsible section ---

interface CollapsibleSectionProps {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  variant: 'red' | 'amber'
}

function CollapsibleSection({ title, count, children, defaultOpen = true, variant }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (count === 0) return null

  const colors = variant === 'red' ? 'text-red-700' : 'text-amber-700'

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-sm font-medium ${colors} hover:opacity-80 transition-opacity mb-1`}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title} ({count})
      </button>
      {open && <div className="space-y-1 ml-1">{children}</div>}
    </div>
  )
}

// --- Main panel ---

interface IntegrityCheckPanelProps {
  report: IntegrityReport
  repairing?: boolean
  onRepair?: () => void
}

/**
 * Shows the integrity report.
 * - Green banner if healthy.
 * - Red section for broken object/field mappings with "Repair" button.
 * - Amber section for type changes.
 */
export function IntegrityCheckPanel({ report, repairing, onRepair }: IntegrityCheckPanelProps) {
  if (report.isHealthy) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>All mappings are intact. Schema is consistent with current mappings.</span>
        <span className="ml-auto text-xs text-green-600">
          Checked {new Date(report.checkedAt).toLocaleTimeString()}
        </span>
      </div>
    )
  }

  const hasBroken = report.brokenObjectMappings.length > 0 || report.brokenFieldMappings.length > 0

  return (
    <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-b border-red-200">
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-800">Integrity issues detected</p>
          <p className="text-xs text-red-600">
            {report.brokenObjectMappings.length > 0 &&
              `${report.brokenObjectMappings.length} broken object mapping${report.brokenObjectMappings.length !== 1 ? 's' : ''}`}
            {report.brokenObjectMappings.length > 0 && report.brokenFieldMappings.length > 0 && ' · '}
            {report.brokenFieldMappings.length > 0 &&
              `${report.brokenFieldMappings.length} broken field mapping${report.brokenFieldMappings.length !== 1 ? 's' : ''}`}
            {(report.brokenObjectMappings.length > 0 || report.brokenFieldMappings.length > 0) &&
              report.typeChanges.length > 0 &&
              ' · '}
            {report.typeChanges.length > 0 &&
              `${report.typeChanges.length} type change${report.typeChanges.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {hasBroken && onRepair && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRepair}
            disabled={repairing}
            className="ml-auto shrink-0"
          >
            {repairing ? 'Repairing…' : 'Repair'}
          </Button>
        )}
        <span className="text-xs text-red-500 shrink-0">
          {!hasBroken && 'Checked '}
          {new Date(report.checkedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Issues */}
      <div className="px-4 py-3 space-y-3">
        <CollapsibleSection
          title="Broken object mappings"
          count={report.brokenObjectMappings.length}
          variant="red"
        >
          {report.brokenObjectMappings.map((item) => (
            <BrokenObjectRow key={item.mappingId} item={item} />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Broken field mappings"
          count={report.brokenFieldMappings.length}
          variant="red"
        >
          {report.brokenFieldMappings.map((item) => (
            <BrokenFieldRow key={item.fieldMappingId} item={item} />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Type changes (incompatible)"
          count={report.typeChanges.length}
          variant="amber"
        >
          {report.typeChanges.map((item) => (
            <TypeChangeRow key={item.fieldMappingId} item={item} />
          ))}
        </CollapsibleSection>
      </div>
    </div>
  )
}
