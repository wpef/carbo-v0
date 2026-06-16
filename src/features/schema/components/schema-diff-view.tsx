'use client'

// 003-source-schema-retrieval — SchemaDiffView component (FR-012, Cluster 11)
// Renders a DriftReport returned by GET /api/plans/[planId]/source/schema/diff.
// Adapted from v3 components/schema/schema-diff.tsx, extended for the richer
// DriftReport structure (DriftChange with severity + affectsMapping).

import type { DriftReport, DriftChange, DriftSeverity } from '@/features/schema/lib/drift'

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<DriftSeverity, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-red-50',     text: 'text-red-700',    dot: 'bg-red-500'    },
  warning:  { bg: 'bg-yellow-50',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  info:     { bg: 'bg-green-50',   text: 'text-green-700',  dot: 'bg-green-500'  },
}

const TYPE_LABELS: Record<string, string> = {
  OBJECT_ADDED:           'Object added',
  OBJECT_REMOVED:         'Object removed',
  FIELD_ADDED:            'Field added',
  FIELD_REMOVED:          'Field removed',
  FIELD_TYPE_CHANGED:     'Type changed',
  FIELD_BECAME_REQUIRED:  'Became required',
  FIELD_BECAME_OPTIONAL:  'Became optional',
  FIELD_LABEL_CHANGED:    'Label changed',
  PICKLIST_VALUE_ADDED:   'Picklist value added',
  PICKLIST_VALUE_REMOVED: 'Picklist value removed',
  FIELD_READONLY_CHANGED: 'Read-only changed',
  FIELD_UNIQUE_CHANGED:   'Uniqueness changed',
}

// ---------------------------------------------------------------------------
// DriftChangeRow
// ---------------------------------------------------------------------------

function DriftChangeRow({ change }: { change: DriftChange }) {
  const style = SEVERITY_STYLES[change.severity]
  const label = TYPE_LABELS[change.type] ?? change.type

  return (
    <li className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${style.bg} ${style.text}`}>
      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className="font-medium">{change.objectApiName}</span>
      {change.fieldApiName && (
        <>
          <span className="text-current/60">.</span>
          <span className="font-mono">{change.fieldApiName}</span>
        </>
      )}
      <span className="ml-auto text-current/70 shrink-0">{label}</span>
      {change.affectsMapping && (
        <span className="shrink-0 px-1.5 py-0.5 rounded bg-current/10 font-semibold">mapping</span>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// SchemaDiffView (exported)
// ---------------------------------------------------------------------------

interface SchemaDiffViewProps {
  report: DriftReport | null
  loading?: boolean
}

export function SchemaDiffView({ report, loading = false }: SchemaDiffViewProps) {
  if (loading) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse">Checking live schema…</p>
    )
  }

  if (!report) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No drift data — retrieve the schema to start tracking changes.
      </p>
    )
  }

  if (report.status === 'unavailable') {
    return (
      <p className="text-sm text-destructive">
        Live check unavailable: {report.reason ?? 'unknown error'}
      </p>
    )
  }

  if (report.status === 'ok') {
    return (
      <p className="text-sm text-muted-foreground">
        Schema is up to date — no changes detected.
      </p>
    )
  }

  // status === 'drift'
  const { changes, severitySummary } = report
  const criticalChanges = changes.filter((c) => c.severity === 'critical')
  const warningChanges  = changes.filter((c) => c.severity === 'warning')
  const infoChanges     = changes.filter((c) => c.severity === 'info')

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-3 text-xs">
        {severitySummary.critical > 0 && (
          <span className="flex items-center gap-1 text-red-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {severitySummary.critical} critical
          </span>
        )}
        {severitySummary.warning > 0 && (
          <span className="flex items-center gap-1 text-yellow-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            {severitySummary.warning} warning
          </span>
        )}
        {severitySummary.info > 0 && (
          <span className="flex items-center gap-1 text-green-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {severitySummary.info} info
          </span>
        )}
      </div>

      {/* Grouped change lists */}
      {criticalChanges.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
            Critical ({criticalChanges.length})
          </p>
          <ul className="space-y-1">
            {criticalChanges.map((c, i) => <DriftChangeRow key={i} change={c} />)}
          </ul>
        </section>
      )}

      {warningChanges.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">
            Warnings ({warningChanges.length})
          </p>
          <ul className="space-y-1">
            {warningChanges.map((c, i) => <DriftChangeRow key={i} change={c} />)}
          </ul>
        </section>
      )}

      {infoChanges.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
            Informational ({infoChanges.length})
          </p>
          <ul className="space-y-1">
            {infoChanges.map((c, i) => <DriftChangeRow key={i} change={c} />)}
          </ul>
        </section>
      )}
    </div>
  )
}
