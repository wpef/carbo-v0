import { NextResponse } from 'next/server'
import { getPlan, deletePlan, PlanNotFoundError } from '@/lib/services/plan-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params
    const plan = await getPlan(planId)
    return NextResponse.json(plan)
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  try {
    const { planId } = await params
    await deletePlan(planId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}
