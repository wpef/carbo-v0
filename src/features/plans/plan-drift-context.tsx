'use client'

// 001 FR-010 / FR-012 / FR-013 / FR-015 / FR-016 — Plan-level drift context (Cluster 11).
//
// Owns ALL drift state for a plan visit:
//  - Fires detectLiveDrift for source + destination in parallel, ONCE per "plan
//    visit" (FR-010), gated by sessionStorage.lastVisitedPlanId.
//  - Merges the two reports (mergeDriftReports) and exposes the merged + per-side
//    reports via context so the banner and the action pages (011 / 012 / documents)
//    can read drift without re-fetching (FR-015).
//  - Exposes refresh() that runs the full-chain refresh for the impacted side(s)
//    then re-checks drift and auto-dismisses (FR-012).
//  - Exposes dismiss() scoped to the current plan visit + drift checkedAt (FR-013):
//    a sessionStorage flag, NOT a bare useState, so it survives intra-plan nav but
//    is re-shown on the next plan reopen.
//
// Mounted in src/app/plans/[planId]/layout.tsx, wrapping the plan content.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  mergeDriftReports,
  type DriftReport,
} from '@/features/schema/lib/drift'

// ---------------------------------------------------------------------------
// sessionStorage keys
// ---------------------------------------------------------------------------

const LAST_VISITED_KEY = 'lastVisitedPlanId'
const ignoreKey = (planId: string, checkedAt: string) => `driftIgnored:${planId}:${checkedAt}`

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface PlanDriftContextValue {
  /** Merged (source + destination) report. null until the first check resolves or when no connection. */
  report: DriftReport | null
  /** Per-side reports (for contextual highlighting that needs to know the side). */
  sourceReport: DriftReport | null
  destinationReport: DriftReport | null
  /** True while a drift check or a refresh is in flight. */
  loading: boolean
  /** True while the full-chain refresh launched from the banner is running. */
  refreshing: boolean
  /** True when the user dismissed the banner for this visit (FR-013). */
  dismissed: boolean
  /** Hide the banner for the rest of this plan visit (scoped to planId + checkedAt). */
  dismiss: () => void
  /** Run the full-chain refresh for the impacted side(s), then re-check drift (FR-012). */
  refresh: () => Promise<void>
}

const PlanDriftContext = createContext<PlanDriftContextValue | null>(null)

/**
 * Read the plan-level drift report. Returns null outside a PlanDriftProvider so
 * downstream pages can call it defensively (e.g. `usePlanDrift()?.report`).
 */
export function usePlanDrift(): PlanDriftContextValue | null {
  return useContext(PlanDriftContext)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PlanDriftProviderProps {
  planId: string
  /** Whether the plan has each connection — absent sides are skipped (001 §computation). */
  hasSource: boolean
  hasDestination: boolean
  children: React.ReactNode
}

async function fetchSideDrift(
  planId: string,
  side: 'source' | 'destination',
): Promise<DriftReport | null> {
  try {
    const res = await fetch(`/api/plans/${planId}/${side}/schema/diff`)
    if (!res.ok) return null
    return (await res.json()) as DriftReport
  } catch {
    return null
  }
}

export function PlanDriftProvider({
  planId,
  hasSource,
  hasDestination,
  children,
}: PlanDriftProviderProps) {
  const [sourceReport, setSourceReport] = useState<DriftReport | null>(null)
  const [destinationReport, setDestinationReport] = useState<DriftReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // FR-013 — dismissal is tracked by the report `checkedAt` the user ignored,
  // not a bare boolean. `dismissed` is derived (report.checkedAt === this), so a
  // fresh drift check (new checkedAt) re-shows the banner automatically. Lazily
  // seeded so an intra-session ignore survives intra-plan navigation.
  const [dismissedCheckedAt, setDismissedCheckedAt] = useState<string | null>(null)

  // The merged report drives the banner. Recomputed from the two sides.
  const report = mergeDriftReports(sourceReport, destinationReport)

  // Derived dismissal: hidden only when the user ignored *this* exact report, or
  // when sessionStorage still carries the ignore flag for it (survives nav).
  const sessionIgnored =
    report != null &&
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(ignoreKey(planId, report.checkedAt)) === '1'
  const dismissed =
    report != null && (dismissedCheckedAt === report.checkedAt || sessionIgnored)

  // Guard so the drift check fires at most once per provider mount (a mount ==
  // one plan visit, because the layout remounts when planId changes).
  const checkedRef = useRef(false)

  const runDriftCheck = useCallback(async () => {
    setLoading(true)
    try {
      const [src, dst] = await Promise.all([
        hasSource ? fetchSideDrift(planId, 'source') : Promise.resolve(null),
        hasDestination ? fetchSideDrift(planId, 'destination') : Promise.resolve(null),
      ])
      setSourceReport(src)
      setDestinationReport(dst)
    } finally {
      setLoading(false)
    }
  }, [planId, hasSource, hasDestination])

  // FR-010 — plan-visit gating via sessionStorage.lastVisitedPlanId.
  // Fire the drift check only when entering this plan from elsewhere (new visit),
  // not on intra-plan navigation. Mark this plan as the last visited.
  useEffect(() => {
    if (checkedRef.current) return
    if (!hasSource && !hasDestination) return
    if (typeof window === 'undefined') return

    const last = window.sessionStorage.getItem(LAST_VISITED_KEY)
    // Always record the current plan as visited so intra-plan nav (which does not
    // remount this provider) and a return to the list both behave correctly.
    window.sessionStorage.setItem(LAST_VISITED_KEY, planId)

    // New visit when we arrive from a different plan / no plan / fresh session.
    const isNewVisit = last !== planId
    checkedRef.current = true
    if (!isNewVisit) return

    // Schedule the network kickoff on a macrotask so no setState runs
    // synchronously within this effect (avoids cascading renders).
    const t = setTimeout(() => void runDriftCheck(), 0)
    return () => clearTimeout(t)
  }, [planId, hasSource, hasDestination, runDriftCheck])

  // FR-013 — ignore for this visit: persist the flag (scoped to planId + checkedAt
  // so it survives intra-plan nav) and record it locally for an instant hide. A
  // fresh check produces a new checkedAt, so the banner reappears on next reopen.
  const dismiss = useCallback(() => {
    if (!report) return
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(ignoreKey(planId, report.checkedAt), '1')
    }
    setDismissedCheckedAt(report.checkedAt)
  }, [planId, report])

  // FR-012 — full-chain refresh for the impacted side(s). A side is "impacted"
  // when its report has at least one critical or warning change. If neither side
  // qualifies (info-only / unavailable) we refresh whatever sides exist so the
  // manual button still does something useful.
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const impacted = (r: DriftReport | null) =>
        !!r && r.status === 'drift' && (r.severitySummary.critical > 0 || r.severitySummary.warning > 0)

      const refreshSource = hasSource && (impacted(sourceReport) || !impacted(destinationReport))
      const refreshDest = hasDestination && (impacted(destinationReport) || !impacted(sourceReport))

      // POST /schema runs the full chain (schema → objects → fields → integrity)
      // server-side and rotates the snapshot, so subsequent live drift is clean.
      await Promise.all([
        refreshSource
          ? fetch(`/api/plans/${planId}/source/schema`, { method: 'POST' }).catch(() => null)
          : Promise.resolve(null),
        refreshDest
          ? fetch(`/api/plans/${planId}/destination/schema`, { method: 'POST' }).catch(() => null)
          : Promise.resolve(null),
      ])

      // Re-check live drift after the refresh; by definition it should now be
      // clean (status 'ok' → the banner stops rendering on its own, FR-012). No
      // explicit dismiss needed: a clean merged report has status !== 'drift'.
      await runDriftCheck()
    } finally {
      setRefreshing(false)
    }
  }, [planId, hasSource, hasDestination, sourceReport, destinationReport, runDriftCheck])

  return (
    <PlanDriftContext.Provider
      value={{
        report,
        sourceReport,
        destinationReport,
        loading,
        refreshing,
        dismissed,
        dismiss,
        refresh,
      }}
    >
      {children}
    </PlanDriftContext.Provider>
  )
}
