// @vitest-environment node
//
// Integration test — lane navigation (cluster 14).
// Tests step advancement via service functions against a test database.
// DO NOT run this file directly — requires live DB (DATABASE_URL from .env.test).

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createPlan, advanceStep } from '@/features/plans/services/plan-service'
import { isForwardStep } from '@/features/plans/lib/steps'

const createdPlanIds: string[] = []

afterAll(async () => {
  for (const id of createdPlanIds) {
    await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  }
  await prisma.$disconnect()
})

async function seedPlan(name: string) {
  const plan = await createPlan({ name })
  createdPlanIds.push(plan.id)
  return plan
}

describe('plan-step integration', () => {
  it('SOURCE → DESTINATION succeeds', async () => {
    const plan = await seedPlan('Step Test 1')
    const updated = await advanceStep(plan.id, 'DESTINATION')
    expect(updated.currentStep).toBe('DESTINATION')
  })

  it('SOURCE → OBJECT_MAPPING succeeds (forward skip allowed)', async () => {
    const plan = await seedPlan('Step Test 2')
    const updated = await advanceStep(plan.id, 'OBJECT_MAPPING')
    expect(updated.currentStep).toBe('OBJECT_MAPPING')
  })

  it('DESTINATION → SOURCE fails (backward navigation not allowed)', async () => {
    const plan = await seedPlan('Step Test 3')
    await advanceStep(plan.id, 'DESTINATION')
    await expect(advanceStep(plan.id, 'SOURCE')).rejects.toThrow()
  })

  it('advancing to DOCUMENTS sets status to READY', async () => {
    const plan = await seedPlan('Step Test 4')
    const updated = await advanceStep(plan.id, 'DOCUMENTS')
    expect(updated.currentStep).toBe('DOCUMENTS')
    expect(updated.status).toBe('READY')
  })

  it('invalid step name throws', async () => {
    const plan = await seedPlan('Step Test 5')
    // @ts-expect-error — intentionally wrong step value
    await expect(advanceStep(plan.id, 'INVALID_STEP')).rejects.toThrow()
  })

  it('audit log ADVANCE_STEP is written with from/to details', async () => {
    const plan = await seedPlan('Step Audit Test')
    await advanceStep(plan.id, 'DESTINATION')
    const logs = await prisma.auditLog.findMany({ where: { planId: plan.id } })
    const stepLog = logs.find((l) => l.action === 'ADVANCE_STEP')
    expect(stepLog).toBeDefined()
    const details = JSON.parse(stepLog!.details as string)
    expect(details.from).toBe('SOURCE')
    expect(details.to).toBe('DESTINATION')
  })
})

describe('isForwardStep unit checks (lib)', () => {
  it('SOURCE → DESTINATION is forward', () => {
    expect(isForwardStep('SOURCE', 'DESTINATION')).toBe(true)
  })
  it('DESTINATION → SOURCE is not forward', () => {
    expect(isForwardStep('DESTINATION', 'SOURCE')).toBe(false)
  })
  it('SOURCE → OBJECT_MAPPING is forward (skip)', () => {
    expect(isForwardStep('SOURCE', 'OBJECT_MAPPING')).toBe(true)
  })
  it('same step is not forward', () => {
    expect(isForwardStep('SOURCE', 'SOURCE')).toBe(false)
  })
})
