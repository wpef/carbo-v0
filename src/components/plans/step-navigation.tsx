// Step navigation bar — Previous / Next links at the bottom of each step page

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

interface StepNavigationProps {
  planId: string
  currentStep: string
  /** Max step the plan has reached (for enabling/disabling next) */
  planCurrentStep?: string
}

export function StepNavigation({ planId, currentStep, planCurrentStep }: StepNavigationProps) {
  const normalized = normalizeStep(currentStep)
  const currentIndex = PLAN_STEPS.findIndex((s) => s.id === normalized)
  const planMax = planCurrentStep
    ? PLAN_STEPS.findIndex((s) => s.id === normalizeStep(planCurrentStep))
    : currentIndex

  const prev = currentIndex > 0 ? PLAN_STEPS[currentIndex - 1] : null
  const next = currentIndex < PLAN_STEPS.length - 1 ? PLAN_STEPS[currentIndex + 1] : null
  const nextAccessible = next && (currentIndex + 1) <= planMax

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
      {prev ? (
        <Link
          href={STEP_HREFS[prev.id]!(planId)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; {prev.label}
        </Link>
      ) : (
        <div />
      )}

      <Link
        href={`/plans/${planId}`}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Vue d&apos;ensemble
      </Link>

      {next ? (
        nextAccessible ? (
          <Link
            href={STEP_HREFS[next.id]!(planId)}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {next.label} &rarr;
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground/50 cursor-not-allowed">
            {next.label} &rarr;
          </span>
        )
      ) : (
        <div />
      )}
    </div>
  )
}
