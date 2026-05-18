'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PLAN_STEPS, STEP_LABELS, STEP_PATHS, getStepIndex } from '../lib/steps'
import type { PlanStepValue } from '../lib/steps'

interface StepSidebarProps {
  planId: string
  currentStep: PlanStepValue
}

export function StepSidebar({ planId, currentStep }: StepSidebarProps) {
  const pathname = usePathname()
  const currentIdx = getStepIndex(currentStep)

  return (
    <nav className="w-56 border-r p-4 shrink-0">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Workflow
      </h2>
      <ul className="space-y-1">
        {PLAN_STEPS.map((step, idx) => {
          const href = `/plans/${planId}/${STEP_PATHS[step]}`
          const isActive = pathname === href
          const isCompleted = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isLocked = idx > currentIdx

          return (
            <li key={step}>
              <Link
                href={isLocked ? '#' : href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive && 'bg-accent font-medium',
                  isCompleted && 'text-foreground',
                  isCurrent && !isActive && 'text-foreground',
                  isLocked && 'text-muted-foreground/50 pointer-events-none',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full text-xs flex items-center justify-center border',
                    isCompleted && 'bg-primary text-primary-foreground border-primary',
                    isCurrent && !isCompleted && 'border-primary text-primary',
                    isLocked && 'border-muted-foreground/30',
                  )}
                >
                  {isCompleted ? '✓' : idx + 1}
                </span>
                {STEP_LABELS[step]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
