'use client'

import { PLAN_STEPS } from '@/lib/types/plan'

interface StepWorkflowProps {
  currentStep: string
}

export function StepWorkflow({ currentStep }: StepWorkflowProps) {
  const currentIndex = PLAN_STEPS.findIndex((s) => s.id === currentStep)

  return (
    <nav className="space-y-2">
      {PLAN_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = step.id === currentStep

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                isCompleted
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isCurrent
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
              }`}
            >
              {isCompleted ? '✓' : step.order}
            </div>
            <span
              className={`text-sm ${
                isCurrent ? 'font-medium text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}
