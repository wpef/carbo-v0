// 020-contractual-document — GET: retrieve a specific contractual document by ID

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getDocument } from '@/lib/services/contractual-document/document-store'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/contractual/[documentId]
 *
 * Return the full contractual document including htmlContent.
 * Returns 404 if the plan or document is not found.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, documentId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const doc = getDocument(planId, documentId)
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: doc.id,
    referenceNumber: doc.referenceNumber,
    mappingPlanId: doc.planId,
    planName: doc.planName,
    generatedAt: doc.generatedAt,
    stats: doc.stats,
    articles: doc.articles,
    htmlContent: doc.html,
  })
}
