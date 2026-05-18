import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type { PlanStepValue } from '../lib/steps'
import { isForwardStep, PLAN_STEPS } from '../lib/steps'

export async function createPlan(data: { name: string; description?: string }) {
  const plan = await prisma.migrationPlan.create({
    data: { name: data.name, description: data.description },
  })
  await logAuditEvent({
    planId: plan.id,
    action: 'CREATE',
    entity: 'MigrationPlan',
    entityId: plan.id,
    details: { name: plan.name },
  })
  console.log(`[PlanService] Created plan: ${plan.id} "${plan.name}"`)
  return plan
}

export async function listPlans() {
  return prisma.migrationPlan.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      currentStep: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getPlan(planId: string) {
  return prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
    },
  })
}

export async function deletePlan(planId: string) {
  await prisma.migrationPlan.delete({ where: { id: planId } })
  console.log(`[PlanService] Deleted plan: ${planId} (cascade)`)
}

export async function advanceStep(planId: string, targetStep: PlanStepValue) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: planId } })
  if (!PLAN_STEPS.includes(targetStep)) {
    throw new Error(`Invalid step: ${targetStep}`)
  }
  if (!isForwardStep(plan.currentStep as PlanStepValue, targetStep)) {
    throw new Error(`Cannot move from ${plan.currentStep} to ${targetStep} (forward-only)`)
  }
  const updated = await prisma.migrationPlan.update({
    where: { id: planId },
    data: { currentStep: targetStep, status: 'IN_PROGRESS' },
  })
  await logAuditEvent({
    planId,
    action: 'ADVANCE_STEP',
    entity: 'MigrationPlan',
    entityId: planId,
    details: { from: plan.currentStep, to: targetStep },
  })
  console.log(`[PlanService] Advanced step: ${plan.currentStep} → ${targetStep}`)
  return updated
}
