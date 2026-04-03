// 016-unmapped-fields-detection — Summary badge showing unmapped field counts

'use client'

import type { UnmappedFieldsSummary } from '@/lib/types/unmapped-fields'

interface UnmappedFieldsSummaryProps {
  summary: UnmappedFieldsSummary
}

/**
 * Small summary badge displayed in toolbars or headers.
 * Shows required unmapped count prominently; secondary counts in muted style.
 * Renders nothing if all counts are zero.
 */
export function UnmappedFieldsSummaryBadge({ summary }: UnmappedFieldsSummaryProps) {
  const { totalUnmappedSource, totalUnmappedDest, totalRequiredUnmapped } = summary

  if (totalUnmappedSource === 0 && totalUnmappedDest === 0) {
    return null
  }

  if (totalRequiredUnmapped > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200"
        title={`${totalRequiredUnmapped} required unmapped source field${totalRequiredUnmapped !== 1 ? 's' : ''}, ${totalUnmappedDest} unmapped required dest field${totalUnmappedDest !== 1 ? 's' : ''}`}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
        {totalRequiredUnmapped} required unmapped
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
      title={`${totalUnmappedSource} unmapped source field${totalUnmappedSource !== 1 ? 's' : ''}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
      {totalUnmappedSource} unmapped
    </span>
  )
}
