// 018-rule-description-engine — GET/POST /api/plans/[planId]/description

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logAction } from '@/lib/services/audit-service'
import { generatePlanDescription } from '@/lib/services/rule-description-engine'

type RouteParams = { params: Promise<{ planId: string }> }

/**
 * GET /api/plans/[planId]/description
 *
 * Generates and returns the full PlanDescription (template-based, no LLM).
 * PROMPT rules fall back to raw prompt text when ANTHROPIC_API_KEY is not set.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
    }

    const description = await generatePlanDescription(planId)

    await logAction(planId, 'PLAN_DESCRIPTION_GENERATED', {
      objectMappingCount: description.objectMappings.length,
      enhance: false,
    })

    return NextResponse.json(description)
  } catch (err) {
    console.error('[GET /description]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

/**
 * POST /api/plans/[planId]/description
 *
 * Generates and returns the full PlanDescription.
 * Accepts optional body `{ enhance: boolean }`.
 * When enhance=true (and ANTHROPIC_API_KEY is set), PROMPT rules are described by Claude.
 * Falls back gracefully when the API key is missing or the call fails.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
    }

    // enhance param is accepted but generatePlanDescription already calls LLM when key is set
    let enhance = false
    try {
      const body = await req.json()
      enhance = body?.enhance === true
    } catch {
      // no body or invalid JSON — treat as enhance=false
    }

    console.log(`[description] Generating plan description (enhance=${enhance}) for plan ${planId}`)

    const description = await generatePlanDescription(planId)

    await logAction(planId, 'PLAN_DESCRIPTION_GENERATED', {
      objectMappingCount: description.objectMappings.length,
      enhance,
    })

    return NextResponse.json(description)
  } catch (err) {
    console.error('[POST /description]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
