import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { STEP_PATHS } from '@/features/plans/lib/steps'
import type { PlanStepValue } from '@/features/plans/lib/steps'

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { currentStep: true },
  })
  if (!plan) notFound()
  redirect(`/plans/${planId}/${STEP_PATHS[plan.currentStep as PlanStepValue]}`)
}
