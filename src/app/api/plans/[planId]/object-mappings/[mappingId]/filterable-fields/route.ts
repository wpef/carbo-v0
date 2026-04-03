// 015-migration-filters — GET filterable source fields for an object mapping

import { NextRequest, NextResponse } from 'next/server'
import { getFilterableFields, MappingNotFoundError } from '@/lib/services/migration-filter'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// GET /api/plans/[planId]/object-mappings/[mappingId]/filterable-fields
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const mapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!mapping || mapping.planId !== planId) throw new MappingNotFoundError(mappingId)

    const fields = await getFilterableFields(mappingId)
    return NextResponse.json({ fields })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /filterable-fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
