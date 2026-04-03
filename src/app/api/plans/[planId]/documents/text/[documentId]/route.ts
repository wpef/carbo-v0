// 019-text-document — GET /api/plans/[planId]/documents/text/[documentId]

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getDocument } from '@/lib/services/text-document/document-store'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/text/[documentId]
 *
 * Retrieve a specific text document including its full htmlContent.
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
    mappingPlanId: doc.planId,
    htmlContent: doc.html,
    generatedAt: doc.generatedAt,
    stats: doc.stats,
  })
}
