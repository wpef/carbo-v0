// 018-rule-description-engine — GET/POST /api/plans/[planId]/description (v4)
//
// Ported from v3 src/app/api/plans/[planId]/description/route.ts.
// v4 imports: prisma from '@/lib/prisma', audit via logAuditEvent from '@/lib/audit'.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { generatePlanDescription } from '@/features/documents/services/plan-description-service'

type RouteParams = { params: Promise<{ planId: string }> }

/**
 * GET /api/plans/[planId]/description
 *
 * Generates and returns the full PlanDescription (template-based, no LLM).
 * PROMPT rules fall back to raw prompt text.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan introuvable : ${planId}` }, { status: 404 })
    }

    const description = await generatePlanDescription(planId)

    await logAuditEvent({
      planId,
      action: 'PLAN_DESCRIPTION_GENERATED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { objectMappingCount: description.objectMappings.length, enhance: false },
    })

    return NextResponse.json(description)
  } catch (err) {
    console.error('[GET /description]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Erreur inattendue.' }, { status: 500 })
  }
}

/**
 * POST /api/plans/[planId]/description
 *
 * Generates and returns the full PlanDescription.
 * Accepts optional body `{ enhance: boolean }`.
 * The `enhance` flag is recorded in the audit trail; the output is identical to GET until
 * the Claude wiring for PROMPT rules lands (graceful fallback in the meantime).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan introuvable : ${planId}` }, { status: 404 })
    }

    let enhance = false
    try {
      const body = await req.json()
      enhance = body?.enhance === true
    } catch {
      // no body or invalid JSON — treat as enhance=false
    }

    console.log(`[description] Generating plan description (enhance=${enhance}) for plan ${planId}`)

    const description = await generatePlanDescription(planId)

    await logAuditEvent({
      planId,
      action: 'PLAN_DESCRIPTION_GENERATED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { objectMappingCount: description.objectMappings.length, enhance },
    })

    return NextResponse.json(description)
  } catch (err) {
    console.error('[POST /description]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Erreur inattendue.' }, { status: 500 })
  }
}
