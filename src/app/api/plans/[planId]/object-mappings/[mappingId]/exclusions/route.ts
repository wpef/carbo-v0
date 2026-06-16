// 016-unmapped-fields-detection — CRUD FieldExclusion per object mapping
// Exclude/re-include a source field from the unmapped-fields report.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createExclusion,
  deleteExclusion,
  listExclusions,
  ObjectMappingNotFoundError,
} from '@/features/unmapped/services/unmapped-service'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/exclusions
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { mappingId } = await params
  try {
    const exclusions = await listExclusions(mappingId)
    return NextResponse.json({ exclusions })
  } catch (err) {
    console.error('[GET /exclusions]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings/[mappingId]/exclusions
// Body: { sourceFieldName: string, reason?: string }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND' }, { status: 404 })
    }

    const body = await req.json()
    const { sourceFieldName, reason } = body
    if (!sourceFieldName) {
      return NextResponse.json({ error: 'INVALID_INPUT', message: 'sourceFieldName is required.' }, { status: 400 })
    }

    const exclusion = await createExclusion(planId, mappingId, sourceFieldName, reason)
    return NextResponse.json({ exclusion }, { status: 201 })
  } catch (err) {
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[POST /exclusions]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/object-mappings/[mappingId]/exclusions?exclusionId=…
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params
  const url = new URL(req.url)
  const exclusionId = url.searchParams.get('exclusionId')
  if (!exclusionId) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'exclusionId query param required' }, { status: 400 })
  }

  try {
    await deleteExclusion(planId, mappingId, exclusionId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /exclusions]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
