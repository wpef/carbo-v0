'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PLAN_STEPS, STEP_LABELS, STEP_PATHS, getStepIndex, getNextStep, normalizeStep } from '../lib/steps'
import type { PlanStepValue } from '../lib/steps'

// FR-007 / FR-008: persistent sidebar, never scrolls.
// Steps COMPLETED/CURRENT are clickable (retrograde nav). Future steps locked.
// Next-step button pinned at bottom: active when activeIndex <= currentMaxIndex.
// On max step → PATCH /step then navigate. On completed step → navigate directly.

interface StepSidebarProps {
  planId: string
  currentStep: PlanStepValue
}

function detectActiveStep(pathname: string): PlanStepValue | undefined {
  if (pathname.includes('/source')) return 'SOURCE'
  if (pathname.includes('/destination')) return 'DESTINATION'
  if (pathname.includes('/object-mapping')) return 'OBJECT_MAPPING'
  if (pathname.includes('/field-mapping')) return 'FIELD_MAPPING'
  if (pathname.includes('/documents')) return 'DOCUMENTS'
  return undefined
}

export function StepSidebar({ planId, currentStep }: StepSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const normalizedCurrent = normalizeStep(currentStep)
  const currentMaxIdx = getStepIndex(normalizedCurrent)
  const activePage = detectActiveStep(pathname)
  const activeIdx = activePage !== undefined ? getStepIndex(activePage) : -1

  const nextStep = activePage !== undefined ? getNextStep(activePage) : null
  // FR-008: button active when on the current step (can advance) or on a completed step (direct nav)
  const nextAccessible = nextStep !== null && activeIdx <= currentMaxIdx

  async function handleNextStep() {
    if (!nextStep) return
    const href = `/plans/${planId}/${STEP_PATHS[nextStep]}`
    // Only call PATCH /step when we're at the current max (need to advance)
    if (activePage && getStepIndex(activePage) >= currentMaxIdx) {
      await fetch(`/api/plans/${planId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStep: nextStep }),
      })
    }
    router.push(href)
  }

  return (
    <aside className="w-52 border-r shrink-0 flex flex-col bg-background">
      <div className="p-4 flex-1 overflow-y-auto min-h-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Workflow
        </p>
        <nav className="space-y-1">
          {PLAN_STEPS.map((step, idx) => {
            const href = `/plans/${planId}/${STEP_PATHS[step]}`
            const isCompleted = idx < currentMaxIdx
            const isCurrent = step === activePage
            const isAccessible = idx <= currentMaxIdx

            const circle = (
              <span
                className={cn(
                  'w-7 h-7 rounded-full text-xs flex items-center justify-center border-2 shrink-0',
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isCompleted
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : isAccessible
                        ? 'border-primary/60 text-primary'
                        : 'border-muted text-muted-foreground',
                )}
              >
                {isCompleted && !isCurrent ? '✓' : idx + 1}
              </span>
            )

            const label = (
              <span
                className={cn(
                  'text-sm',
                  isCurrent ? 'font-semibold text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[step]}
              </span>
            )

            if (isAccessible) {
              return (
                <Link
                  key={step}
                  href={href}
                  className="flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {circle}
                  {label}
                </Link>
              )
            }

            return (
              <div key={step} className="flex items-center gap-3 px-2 py-1.5 -mx-2">
                {circle}
                {label}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Next step button pinned at bottom of sidebar */}
      {activePage && nextStep && (
        <div className="p-4 border-t shrink-0">
          <button
            type="button"
            onClick={handleNextStep}
            disabled={!nextAccessible}
            className={cn(
              'w-full text-sm rounded-lg px-3 py-2 font-medium transition-colors',
              nextAccessible
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground/50 cursor-not-allowed',
            )}
          >
            {STEP_LABELS[nextStep]} &rarr;
          </button>
        </div>
      )}
    </aside>
  )
}
