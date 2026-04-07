import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { PLAN_STEPS, normalizeStep } from '@/lib/types/plan'
import type { PlanStep } from '@/lib/types/plan'

// PATCH /api/plans/[planId]/step
// Advance the plan to a given step (forward-only).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  let body: { step?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const targetStep = body.step as PlanStep | undefined
  if (!targetStep || !PLAN_STEPS.find((s) => s.id === targetStep)) {
    return NextResponse.json(
      { error: `Invalid step. Must be one of: ${PLAN_STEPS.map((s) => s.id).join(', ')}` },
      { status: 400 },
    )
  }

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found.' }, { status: 404 })
  }

  const currentNormalized = normalizeStep(plan.currentStep)
  const currentIndex = PLAN_STEPS.findIndex((s) => s.id === currentNormalized)
  const targetIndex = PLAN_STEPS.findIndex((s) => s.id === targetStep)

  if (targetIndex <= currentIndex) {
    return NextResponse.json(
      { error: `Cannot move backward. Current step: ${currentNormalized}, requested: ${targetStep}` },
      { status: 400 },
    )
  }

  const updated = await prisma.migrationPlan.update({
    where: { id: planId },
    data: { currentStep: targetStep },
  })

  return NextResponse.json({ currentStep: updated.currentStep })
}
