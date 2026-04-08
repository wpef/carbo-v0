// Shared layout for all plan sub-pages — persistent header + workflow sidebar with next-step

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PLAN_STEPS, normalizeStep } from '@/lib/types/plan'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionInfo {
  adapterType: string
  status: string
}

interface PlanData {
  id: string
  name: string
  status: string
  currentStep: string
  sourceConnection: ConnectionInfo | null
  destinationConnection: ConnectionInfo | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_HREFS: Record<string, (planId: string) => string> = {
  SOURCE: (id) => `/plans/${id}/source`,
  DESTINATION: (id) => `/plans/${id}/destination`,
  MAPPING: (id) => `/plans/${id}/mapping`,
  FIELD_MAPPING: (id) => `/plans/${id}/field-mapping`,
  DOCUMENTS: (id) => `/plans/${id}/documents`,
}

const ADAPTER_LABELS: Record<string, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  demo: 'Demo',
  'demo-destination': 'Demo Dest',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-muted text-muted-foreground' },
  READY: { label: 'Prêt', color: 'bg-green-100 text-green-700' },
  BROKEN: { label: 'Erreur', color: 'bg-red-100 text-red-700' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectActivePage(pathname: string): string | undefined {
  if (pathname.includes('/source')) return 'SOURCE'
  if (pathname.includes('/destination')) return 'DESTINATION'
  if (pathname.includes('/field-mapping')) return 'FIELD_MAPPING'
  if (pathname.includes('/mapping')) return 'MAPPING'
  if (pathname.includes('/documents')) return 'DOCUMENTS'
  return undefined
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ planId: string }>()
  const planId = params.planId
  const pathname = usePathname()
  const router = useRouter()

  const [plan, setPlan] = useState<PlanData | null>(null)

  const refreshPlan = useCallback(() => {
    if (!planId) return
    fetch(`/api/plans/${planId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPlan(data))
      .catch(() => {})
  }, [planId])

  useEffect(() => { refreshPlan() }, [refreshPlan])
  // Refresh plan data on route change to pick up step advancement
  useEffect(() => { refreshPlan() }, [pathname, refreshPlan])

  const activePage = detectActivePage(pathname)
  const normalized = plan ? normalizeStep(plan.currentStep) : 'SOURCE'
  const currentMaxIndex = PLAN_STEPS.findIndex((s) => s.id === normalized)
  const activeIndex = activePage
    ? PLAN_STEPS.findIndex((s) => s.id === activePage)
    : -1

  // Next step logic
  const nextStep = activeIndex >= 0 && activeIndex < PLAN_STEPS.length - 1
    ? PLAN_STEPS[activeIndex + 1]
    : null
  // Active if next step is already unlocked OR we're on the current max step (can advance)
  const nextAccessible = nextStep && activeIndex <= currentMaxIndex

  async function handleNextStep() {
    if (!nextStep) return
    const href = STEP_HREFS[nextStep.id]?.(planId)
    if (!href) return

    // If we're at the max step, advance the plan first
    if (activeIndex >= currentMaxIndex) {
      await fetch(`/api/plans/${planId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep.id }),
      })
    }

    router.push(href)
    // Refresh plan data so sidebar updates
    setTimeout(refreshPlan, 300)
  }

  const statusInfo = plan ? STATUS_LABELS[plan.status] ?? STATUS_LABELS.DRAFT : null

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar — fixed height */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4 bg-background shrink-0">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          &larr; Plans
        </Link>

        {plan && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <Link
              href={`/plans/${planId}`}
              className="text-sm font-medium hover:text-foreground transition-colors truncate"
            >
              {plan.name}
            </Link>

            {/* Status badge */}
            {statusInfo && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}

            {/* Source / Destination info */}
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              {plan.sourceConnection ? (
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${plan.sourceConnection.status === 'CONNECTED' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  {ADAPTER_LABELS[plan.sourceConnection.adapterType] ?? plan.sourceConnection.adapterType}
                </span>
              ) : (
                <span className="text-muted-foreground/40">Source non configurée</span>
              )}

              <span className="text-muted-foreground/30">&rarr;</span>

              {plan.destinationConnection ? (
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${plan.destinationConnection.status === 'CONNECTED' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  {ADAPTER_LABELS[plan.destinationConnection.adapterType] ?? plan.destinationConnection.adapterType}
                </span>
              ) : (
                <span className="text-muted-foreground/40">Destination non configurée</span>
              )}
            </div>
          </>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — fills remaining height, never scrolls off */}
        <aside className="w-52 shrink-0 border-r border-border bg-background flex flex-col">
          <div className="p-5 flex-1 overflow-y-auto min-h-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Workflow
            </p>
            {plan ? (
              <nav className="space-y-2">
                {PLAN_STEPS.map((step, index) => {
                  const isCompleted = index < currentMaxIndex
                  const isCurrent = step.id === activePage
                  const isAccessible = index <= currentMaxIndex
                  const href = STEP_HREFS[step.id]?.(planId)

                  const circle = (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 shrink-0 ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground border-primary'
                          : isCompleted
                            ? 'bg-primary/20 text-primary border-primary/40'
                            : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted && !isCurrent ? '✓' : step.order}
                    </div>
                  )

                  const label = (
                    <span
                      className={`text-sm ${
                        isCurrent ? 'font-semibold text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  )

                  if (isAccessible && href) {
                    return (
                      <Link key={step.id} href={href} className="flex items-center gap-3 hover:bg-muted/50 rounded-lg px-2 py-1 -mx-2 transition-colors">
                        {circle}
                        {label}
                      </Link>
                    )
                  }

                  return (
                    <div key={step.id} className="flex items-center gap-3 px-2 py-1 -mx-2">
                      {circle}
                      {label}
                    </div>
                  )
                })}
              </nav>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="h-3 bg-muted rounded w-20 animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next step button — pinned at bottom */}
          {activePage && nextStep && (
            <div className="p-4 border-t border-border shrink-0">
              <button
                type="button"
                disabled={!nextAccessible}
                onClick={handleNextStep}
                className={`w-full text-sm rounded-lg px-3 py-2 font-medium transition-colors ${
                  nextAccessible
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                }`}
              >
                {nextStep.label} &rarr;
              </button>
            </div>
          )}
        </aside>

        {/* Main content — scrolls independently */}
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
