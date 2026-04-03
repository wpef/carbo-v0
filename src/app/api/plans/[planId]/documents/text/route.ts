// 019-text-document — POST: generate text document | GET: list generated documents

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateTextDocument } from '@/lib/services/text-document'
import { storeDocument, listDocuments } from '@/lib/services/text-document/document-store'

type RouteParams = { params: Promise<{ planId: string }> }

/**
 * POST /api/plans/[planId]/documents/text
 *
 * Generate a new text document for the plan.
 * Returns 201 with document metadata (no htmlContent).
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const doc = await generateTextDocument(planId)

    const stored = storeDocument({
      planId: doc.planId,
      planName: doc.planName,
      generatedAt: doc.generatedAt,
      stats: doc.stats,
      html: doc.html,
    })

    return NextResponse.json(
      {
        id: stored.id,
        mappingPlanId: stored.planId,
        generatedAt: stored.generatedAt,
        stats: stored.stats,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /documents/text]', err)
    return NextResponse.json(
      { error: 'Document generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

/**
 * GET /api/plans/[planId]/documents/text
 *
 * List all text document versions for a plan, newest first.
 * Does NOT include htmlContent to keep the response lightweight.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const docs = listDocuments(planId)

  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      generatedAt: d.generatedAt,
      stats: d.stats,
    })),
  })
}
