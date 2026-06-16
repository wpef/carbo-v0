// 015-migration-filters — GET list + POST create filters for an object mapping

import { NextResponse } from 'next/server'
import {
  listFilters,
  createFilter,
  MappingNotFoundError,
  InvalidFilterOperatorError,
  FilterFieldNotFoundError,
} from '@/features/filters/services/filter-service'
import { prisma } from '@/lib/prisma'

// GET /api/plans/[planId]/object-mappings/[mappingId]/filters
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })
    }

    const mapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!mapping || mapping.planId !== planId) {
      return NextResponse.json({ error: 'Mapping introuvable.' }, { status: 404 })
    }

    const result = await listFilters(mappingId)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[GET /filters]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings/[mappingId]/filters
// Body: { fieldApiName, operator, value? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })
    }

    const body = await request.json()
    const { fieldApiName, operator, value } = body

    if (!fieldApiName || !operator) {
      return NextResponse.json(
        { error: 'fieldApiName et operator sont requis.' },
        { status: 400 },
      )
    }

    const filter = await createFilter(mappingId, { fieldApiName, operator, value })
    return NextResponse.json(filter, { status: 201 })
  } catch (err) {
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof FilterFieldNotFoundError) {
      // FR-005: 422 Unprocessable Entity when source field does not exist
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    if (err instanceof InvalidFilterOperatorError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[POST /filters]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}
