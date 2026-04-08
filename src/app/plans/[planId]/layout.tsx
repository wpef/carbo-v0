// Shared layout for all plan sub-pages — always shows the step workflow sidebar

'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { StepWorkflow } from '@/components/plans/step-workflow'

interface Plan {
  id: string
  name: string
  currentStep: string
}

/** Derive which workflow step the current pathname corresponds to */
function detectActivePage(pathname: string): string | undefined {
  if (pathname.includes('/source')) return 'SOURCE'
  if (pathname.includes('/destination')) return 'DESTINATION'
  if (pathname.includes('/field-mapping')) return 'FIELD_MAPPING'
  if (pathname.includes('/mapping')) return 'MAPPING'
  if (pathname.includes('/documents')) return 'DOCUMENTS'
  return undefined
}

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ planId: string }>()
  const planId = params.planId
  const pathname = usePathname()

  const [plan, setPlan] = useState<Plan | null>(null)

  useEffect(() => {
    if (!planId) return
    fetch(`/api/plans/${planId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPlan(data))
      .catch(() => {})
  }, [planId])

  const activePage = detectActivePage(pathname)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4 bg-background shrink-0">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Plans
        </Link>
        {plan && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <Link
              href={`/plans/${planId}`}
              className="text-sm font-medium hover:text-foreground transition-colors truncate max-w-xs"
            >
              {plan.name}
            </Link>
          </>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — always visible */}
        <aside className="w-52 shrink-0 border-r border-border p-5 bg-background">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Workflow
          </p>
          {plan ? (
            <StepWorkflow planId={planId} currentStep={plan.currentStep} activePage={activePage} />
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
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
