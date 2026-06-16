'use client'

// 003-source-schema-retrieval — DriftBanner (FR-012, Cluster 11)
// Fetches the live drift report for the source connection and renders a
// dismissible top-of-plan banner when status='drift'.
// Mounted inside src/app/plans/[planId]/layout.tsx.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { DriftReport } from '@/features/schema/lib/drift'

interface DriftBannerProps {
  planId: string
}

export function DriftBanner({ planId }: DriftBannerProps) {
  const [report, setReport] = useState<DriftReport | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!planId) return
    // Non-blocking: if the fetch fails we simply don't show the banner
    fetch(`/api/plans/${planId}/source/schema/diff`)
      .then((res) => (res.ok ? (res.json() as Promise<DriftReport>) : null))
      .then((data) => {
        if (data) setReport(data)
      })
      .catch(() => {})
  }, [planId])

  if (dismissed || !report || report.status !== 'drift') return null

  const { severitySummary } = report
  const hasCritical = severitySummary.critical > 0
  const totalChanges = severitySummary.critical + severitySummary.warning + severitySummary.info

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-2 text-sm border-b shrink-0 ${
        hasCritical
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${hasCritical ? 'bg-red-500' : 'bg-yellow-500'}`}
      />
      <span className="flex-1">
        <strong>Schema drift detected</strong> — {totalChanges} change
        {totalChanges !== 1 ? 's' : ''} since last snapshot
        {hasCritical ? ` (${severitySummary.critical} critical)` : ''}.{' '}
        <Link
          href={`/plans/${planId}/source`}
          className="underline underline-offset-2 font-medium hover:opacity-75"
        >
          View source schema
        </Link>
      </span>
      <button
        type="button"
        aria-label="Dismiss drift banner"
        onClick={() => setDismissed(true)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        &times;
      </button>
    </div>
  )
}
