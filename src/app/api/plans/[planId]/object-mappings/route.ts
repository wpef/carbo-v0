// 011-object-mapping — GET list + POST create object mappings

import { NextRequest, NextResponse } from 'next/server'
import {
  listObjectMappings,
  createObjectMapping,
  DuplicateMappingError,
} from '@/lib/services/object-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// GET /api/plans/[planId]/object-mappings
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const mappings = await listObjectMappings(planId)
    return NextResponse.json({ mappings })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /object-mappings]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings
// Body: { sourceObjectId, sourceObjectApiName, destObjectId, destObjectApiName }
export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const body = await req.json()
    const { sourceObjectId, sourceObjectApiName, destObjectId, destObjectApiName } = body

    if (!sourceObjectId || !sourceObjectApiName || !destObjectId || !destObjectApiName) {
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: 'sourceObjectId, sourceObjectApiName, destObjectId, and destObjectApiName are required.',
        },
        { status: 400 },
      )
    }

    const mapping = await createObjectMapping(
      planId,
      sourceObjectId,
      sourceObjectApiName,
      destObjectId,
      destObjectApiName,
    )

    return NextResponse.json({ mapping }, { status: 201 })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof DuplicateMappingError) {
      return NextResponse.json({ error: 'DUPLICATE_MAPPING', message: err.message }, { status: 409 })
    }
    console.error('[POST /object-mappings]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
