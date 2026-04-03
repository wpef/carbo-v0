// 020-contractual-document — POST: generate contractual document | GET: list generated documents

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateContractualDocument } from '@/lib/services/contractual-document'
import { storeDocument, listDocuments } from '@/lib/services/contractual-document/document-store'

type RouteParams = { params: Promise<{ planId: string }> }

/**
 * POST /api/plans/[planId]/documents/contractual
 *
 * Generate a new contractual document for the plan.
 * Returns 201 with document metadata (no htmlContent in list view).
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const doc = await generateContractualDocument(planId)

    const stored = storeDocument({
      planId: doc.planId,
      planName: doc.planName,
      referenceNumber: doc.referenceNumber,
      generatedAt: doc.generatedAt,
      stats: doc.stats,
      articles: doc.articles,
      html: doc.html,
    })

    return NextResponse.json(
      {
        id: stored.id,
        referenceNumber: stored.referenceNumber,
        mappingPlanId: stored.planId,
        generatedAt: stored.generatedAt,
        stats: stored.stats,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[POST /documents/contractual]', err)
    return NextResponse.json(
      { error: 'Document generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

/**
 * GET /api/plans/[planId]/documents/contractual
 *
 * List all contractual document versions for a plan, newest first.
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
      referenceNumber: d.referenceNumber,
      generatedAt: d.generatedAt,
      stats: d.stats,
    })),
  })
}
