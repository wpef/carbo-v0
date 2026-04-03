// 017-mapping-integrity-check — Small badge showing plan health status

'use client'

import type { IntegrityReport } from '@/lib/types/integrity'

interface IntegrityBadgeProps {
  report: IntegrityReport | null
  loading?: boolean
}

/**
 * Small badge showing plan integrity health status.
 * - Green: healthy
 * - Amber: type changes only (warnings)
 * - Red: broken mappings
 * Shows nothing while loading.
 */
export function IntegrityBadge({ report, loading }: IntegrityBadgeProps) {
  if (loading || !report) return null

  const hasBroken =
    report.brokenObjectMappings.length > 0 || report.brokenFieldMappings.length > 0
  const hasTypeChanges = report.typeChanges.length > 0

  if (report.isHealthy) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
        Healthy
      </span>
    )
  }

  if (hasBroken) {
    const count = report.brokenObjectMappings.length + report.brokenFieldMappings.length
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
        {count} broken
      </span>
    )
  }

  if (hasTypeChanges) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        {report.typeChanges.length} type change{report.typeChanges.length !== 1 ? 's' : ''}
      </span>
    )
  }

  return null
}
