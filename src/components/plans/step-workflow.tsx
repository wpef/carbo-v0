'use client'

import Link from 'next/link'
import { PLAN_STEPS, normalizeStep } from '@/lib/types/plan'

const STEP_HREFS: Record<string, (planId: string) => string> = {
  SOURCE: (id) => `/plans/${id}/source`,
  DESTINATION: (id) => `/plans/${id}/destination`,
  MAPPING: (id) => `/plans/${id}/mapping`,
  FIELD_MAPPING: (id) => `/plans/${id}/field-mapping`,
  DOCUMENTS: (id) => `/plans/${id}/documents`,
}

interface StepWorkflowProps {
  planId: string
  currentStep: string
}

export function StepWorkflow({ planId, currentStep }: StepWorkflowProps) {
  const normalized = normalizeStep(currentStep)
  const currentIndex = PLAN_STEPS.findIndex((s) => s.id === normalized)

  return (
    <nav className="space-y-2">
      {PLAN_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = step.id === normalized
        const isAccessible = isCompleted || isCurrent
        const href = STEP_HREFS[step.id]?.(planId)

        const circle = (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 shrink-0 ${
              isCompleted
                ? 'bg-primary text-primary-foreground border-primary'
                : isCurrent
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted-foreground'
            }`}
          >
            {isCompleted ? '✓' : step.order}
          </div>
        )

        const label = (
          <span
            className={`text-sm ${
              isCurrent ? 'font-medium text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
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
  )
}
