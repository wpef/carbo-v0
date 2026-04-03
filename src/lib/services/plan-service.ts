import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import type { CreatePlanInput } from '@/lib/types/plan'

export class PlanNotFoundError extends Error {
  constructor(id: string) {
    super(`Plan not found: ${id}`)
    this.name = 'PlanNotFoundError'
  }
}

export async function createPlan(input: CreatePlanInput) {
  const plan = await prisma.migrationPlan.create({
    data: {
      name: input.name,
      description: input.description ?? null,
    },
  })

  await logAction(plan.id, 'PLAN_CREATED', { name: plan.name })

  return plan
}

export async function listPlans() {
  return prisma.migrationPlan.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPlan(id: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id } })
  if (!plan) throw new PlanNotFoundError(id)
  return plan
}

export async function deletePlan(id: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id } })
  if (!plan) throw new PlanNotFoundError(id)

  await prisma.migrationPlan.delete({ where: { id } })
  await logAction(null, 'PLAN_DELETED', { planId: id, name: plan.name })

  return plan
}
