// 016-unmapped-fields-detection — GET unmapped fields for a single object mapping
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnmappedFieldsForMapping, ObjectMappingNotFoundError } from '@/features/unmapped/services/unmapped-service'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/unmapped
// Returns the unmapped-fields report (computeUnmappedFields) for one object mapping.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
    }

    const report = await getUnmappedFieldsForMapping(planId, mappingId)
    return NextResponse.json(report)
  } catch (err) {
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /object-mappings/[mappingId]/unmapped]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
