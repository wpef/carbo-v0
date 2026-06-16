// 015-migration-filters — GET source filterable fields for an object mapping

import { NextResponse } from 'next/server'
import {
  getFilterableFields,
  MappingNotFoundError,
} from '@/features/filters/services/filter-service'
import { prisma } from '@/lib/prisma'

// GET /api/plans/[planId]/object-mappings/[mappingId]/filterable-fields
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

    const fields = await getFilterableFields(mappingId)
    return NextResponse.json({ fields })
  } catch (err) {
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[GET /filterable-fields]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}
