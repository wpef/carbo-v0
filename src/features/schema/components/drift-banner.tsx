'use client'

// 001 FR-012 / FR-013 / FR-016 — DriftBanner (Cluster 11).
// Reads the merged plan-level DriftReport from PlanDriftContext (no fetching of
// its own — the provider owns the plan-visit gating per FR-010). Renders a
// persistent, non-blocking banner at the top of the plan content area when the
// merged report has at least one critical or warning change, or a degraded
// state when a side is unavailable (FR-016).
//
// Actions:
//  - [Rafraîchir le schéma] (primary): full-chain refresh of impacted side(s)
//    via context.refresh(); auto-dismisses on success (FR-012).
//  - [Ignorer pour cette session] (secondary): context.dismiss(), scoped to the
//    plan visit + drift checkedAt via sessionStorage (FR-013).

import { useState } from 'react'
import { usePlanDrift } from '@/features/plans/plan-drift-context'
import { SchemaDiffView } from '@/features/schema/components/schema-diff-view'

export function DriftBanner() {
  const drift = usePlanDrift()
  const [expanded, setExpanded] = useState(false)

  // Outside a provider, or nothing to show yet.
  if (!drift) return null
  const { report, dismissed, refreshing, dismiss, refresh } = drift
  if (dismissed || !report) return null

  // FR-016 — degraded state: a side could not be checked (network / quota / token).
  if (report.status === 'unavailable') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 px-4 py-2 text-sm border-b shrink-0 bg-slate-50 border-slate-200 text-slate-700"
      >
        <span className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
        <span className="flex-1">
          Impossible de vérifier le schéma — connexion ou quota indisponible.
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {refreshing ? 'Rafraîchissement…' : 'Rafraîchir le schéma'}
        </button>
        <button
          type="button"
          aria-label="Ignorer"
          onClick={dismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
        >
          &times;
        </button>
      </div>
    )
  }

  // Only surface a banner when there is actionable (critical/warning) drift.
  if (report.status !== 'drift') return null
  const { critical, warning } = report.severitySummary
  if (critical === 0 && warning === 0) return null // info-only → no banner (001 leaves room)

  const hasCritical = critical > 0

  // FR — French summary line (001 §Banner UX). Omit zero counts.
  const parts: string[] = []
  if (critical > 0) parts.push(`${critical} changement${critical > 1 ? 's' : ''} critique${critical > 1 ? 's' : ''}`)
  if (warning > 0) parts.push(`${warning} changement${warning > 1 ? 's' : ''} à surveiller`)
  const summary = `Le schéma a évolué depuis votre dernière visite : ${parts.join(', ')}.`

  return (
    <div
      role="alert"
      className={`border-b shrink-0 ${
        hasCritical
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${hasCritical ? 'bg-red-500' : 'bg-yellow-500'}`}
        />
        <span className="flex-1">
          <strong>{summary}</strong>{' '}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="underline underline-offset-2 font-medium hover:opacity-75"
          >
            {expanded ? 'Masquer le détail' : 'Voir le détail'}
          </button>
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 ${
            hasCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
        >
          {refreshing ? 'Rafraîchissement…' : 'Rafraîchir le schéma'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border border-current/30 px-2.5 py-1 text-xs font-medium hover:bg-current/10"
        >
          Ignorer pour cette session
        </button>
      </div>

      {/* Categorized breakdown (001 §Banner UX — grouped by severity, with object/field context). */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-white/40">
          <SchemaDiffView report={report} />
        </div>
      )}
    </div>
  )
}
