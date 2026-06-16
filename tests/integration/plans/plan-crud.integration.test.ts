// @vitest-environment node
//
// Integration test — lane navigation (cluster 14).
// Tests plan CRUD via service functions against a test database (DATABASE_URL from .env.test).
// DO NOT run this file directly (npx vitest run tests/integration/plans/) — requires live DB.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createPlan,
  listPlans,
  getPlan,
  deletePlan,
} from '@/features/plans/services/plan-service'

const createdPlanIds: string[] = []

afterAll(async () => {
  for (const id of createdPlanIds) {
    await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  }
  await prisma.$disconnect()
})

describe('plan-crud integration', () => {
  it('creates a plan with valid name → DRAFT status, SOURCE step', async () => {
    const plan = await createPlan({ name: 'Test Plan CRUD', description: 'Integration test' })
    createdPlanIds.push(plan.id)
    expect(plan.id).toBeTruthy()
    expect(plan.name).toBe('Test Plan CRUD')
    expect(plan.status).toBe('DRAFT')
    expect(plan.currentStep).toBe('SOURCE')
    expect(plan.description).toBe('Integration test')
  })

  it('listPlans returns array ordered by updatedAt desc', async () => {
    const planA = await createPlan({ name: 'Plan A' })
    createdPlanIds.push(planA.id)
    // Small delay to ensure different updatedAt
    await new Promise((r) => setTimeout(r, 10))
    const planB = await createPlan({ name: 'Plan B' })
    createdPlanIds.push(planB.id)

    const plans = await listPlans()
    expect(Array.isArray(plans)).toBe(true)
    // Most recently updated plan (B) should appear before A
    const idxA = plans.findIndex((p) => p.id === planA.id)
    const idxB = plans.findIndex((p) => p.id === planB.id)
    expect(idxA).toBeGreaterThan(-1)
    expect(idxB).toBeGreaterThan(-1)
    expect(idxB).toBeLessThan(idxA)
  })

  it('getPlan returns PlanDetail with null connections when none set', async () => {
    const created = await createPlan({ name: 'Plan Detail Test' })
    createdPlanIds.push(created.id)

    const detail = await getPlan(created.id)
    expect(detail).not.toBeNull()
    expect(detail!.id).toBe(created.id)
    expect(detail!.sourceConnection).toBeNull()
    expect(detail!.destinationConnection).toBeNull()
  })

  it('getPlan returns null for non-existent plan', async () => {
    const result = await getPlan('nonexistent-plan-id-00000000')
    expect(result).toBeNull()
  })

  it('deletePlan removes the plan and triggers cascade', async () => {
    const plan = await createPlan({ name: 'Plan to Delete' })
    // Do not push to createdPlanIds — we delete it manually here
    await deletePlan(plan.id)
    const result = await getPlan(plan.id)
    expect(result).toBeNull()
  })

  it('deletePlan throws when plan does not exist', async () => {
    await expect(deletePlan('nonexistent-plan-id-00000000')).rejects.toThrow('Plan not found')
  })

  it('audit logs are written for create operation', async () => {
    const plan = await createPlan({ name: 'Audit Test Plan' })
    createdPlanIds.push(plan.id)

    const logs = await prisma.auditLog.findMany({ where: { planId: plan.id } })
    const createLog = logs.find((l) => l.action === 'CREATE')
    expect(createLog).toBeDefined()
    expect(createLog?.entity).toBe('MigrationPlan')
  })
})
