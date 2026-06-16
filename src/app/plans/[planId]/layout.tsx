import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PlanHeader } from '@/features/plans/components/plan-header'
import { StepSidebar } from '@/features/plans/components/step-sidebar'
import { DriftBanner } from '@/features/schema/components/drift-banner'
import type { PlanStepValue } from '@/features/plans/lib/steps'

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
    select: { id: true, name: true, status: true, currentStep: true },
  })
  if (!plan) notFound()

  return (
    <div className="h-screen flex flex-col">
      <PlanHeader planId={plan.id} name={plan.name} status={plan.status} />
      {/* Drift banner — client component, fetches /source/schema/diff on mount.
          Only visible when the source schema has drifted since last snapshot. */}
      <DriftBanner planId={plan.id} />
      <div className="flex flex-1 overflow-hidden">
        <StepSidebar planId={plan.id} currentStep={plan.currentStep as PlanStepValue} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
