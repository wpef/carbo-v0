import { NextResponse } from 'next/server'
import { getPlan, deletePlan } from '@/features/plans/services/plan-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await getPlan(planId)
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  return NextResponse.json(plan)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    await deletePlan(planId)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }
}
