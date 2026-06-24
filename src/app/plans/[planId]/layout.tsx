// FR-007: persistent layout with fixed header + sidebar + scrollable main.
// Header and sidebar never scroll (h-screen overflow-hidden structure).
// Fetches plan with connections to populate header connector dots (FR-009).

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PlanHeader } from '@/features/plans/components/plan-header'
import { StepSidebar } from '@/features/plans/components/step-sidebar'
import { DriftBanner } from '@/features/schema/components/drift-banner'
import { PlanDriftProvider } from '@/features/plans/plan-drift-context'
import { normalizeStep } from '@/features/plans/lib/steps'
import type { PlanStepValue } from '@/features/plans/lib/steps'
import type { ConnectionInfo } from '@/features/plans/types'

export default async function PlanLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ planId: string }>
}) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      status: true,
      currentStep: true,
      sourceConnection: { select: { id: true, adapterType: true, status: true } },
      destinationConnection: { select: { id: true, adapterType: true, status: true } },
    },
  })
  if (!plan) notFound()

  const currentStep = normalizeStep(plan.currentStep)

  return (
    // PlanDriftProvider (001 FR-015) owns the plan-visit drift check + merged
    // report; the banner and downstream action pages read it from context.
    <PlanDriftProvider
      planId={plan.id}
      hasSource={plan.sourceConnection != null}
      hasDestination={plan.destinationConnection != null}
    >
      <div className="h-screen flex flex-col overflow-hidden">
        <PlanHeader
          planId={plan.id}
          name={plan.name}
          status={plan.status as 'DRAFT' | 'READY' | 'BROKEN'}
          sourceConnection={plan.sourceConnection as ConnectionInfo | null}
          destinationConnection={plan.destinationConnection as ConnectionInfo | null}
        />
        {/* Drift banner — client component, non-blocking (FR-011). */}
        <DriftBanner />
        <div className="flex flex-1 min-h-0">
          <StepSidebar planId={plan.id} currentStep={currentStep as PlanStepValue} />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </PlanDriftProvider>
  )
}
