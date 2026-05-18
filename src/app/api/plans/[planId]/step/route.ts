import { NextResponse } from 'next/server'
import { advanceStep } from '@/features/plans/services/plan-service'
import type { PlanStepValue } from '@/features/plans/lib/steps'

export async function PATCH(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()
  if (!body.step) {
    return NextResponse.json({ error: 'step is required' }, { status: 400 })
  }
  try {
    const plan = await advanceStep(planId, body.step as PlanStepValue)
    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
