// 015-migration-filters — GET list + POST create filters for an object mapping

import { NextRequest, NextResponse } from 'next/server'
import {
  listFilters,
  createFilter,
  MappingNotFoundError,
  InvalidFilterOperatorError,
} from '@/lib/services/migration-filter'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// GET /api/plans/[planId]/object-mappings/[mappingId]/filters
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

    const filters = await listFilters(mappingId)
    return NextResponse.json({ filters })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /filters]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings/[mappingId]/filters
// Body: { fieldApiName, operator, value? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const body = await req.json()
    const { fieldApiName, operator, value } = body

    if (!fieldApiName || !operator) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'fieldApiName and operator are required.' },
        { status: 400 },
      )
    }

    const filter = await createFilter(mappingId, { fieldApiName, operator, value })
    return NextResponse.json({ filter }, { status: 201 })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof InvalidFilterOperatorError) {
      return NextResponse.json({ error: 'INVALID_OPERATOR', message: err.message }, { status: 400 })
    }
    console.error('[POST /filters]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
