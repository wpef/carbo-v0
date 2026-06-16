// 015-migration-filters — GET estimated record count for an object mapping's active filters

import { NextResponse } from 'next/server'
import {
  estimateFilteredCount,
  MappingNotFoundError,
} from '@/features/filters/services/filter-service'
import { prisma } from '@/lib/prisma'

// GET /api/plans/[planId]/object-mappings/[mappingId]/filters/estimate
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

    // Always returns 200; body indicates availability (FR-004, spec edge case: unreachable source)
    const estimate = await estimateFilteredCount(mappingId)
    return NextResponse.json(estimate)
  } catch (err) {
    if (err instanceof MappingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[GET /filters/estimate]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}
