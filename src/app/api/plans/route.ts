import { NextResponse } from 'next/server'
import { createPlan, listPlans } from '@/features/plans/services/plan-service'

export async function GET() {
  const plans = await listPlans()
  return NextResponse.json(plans)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const plan = await createPlan({ name: body.name.trim(), description: body.description })
  return NextResponse.json(plan, { status: 201 })
}
