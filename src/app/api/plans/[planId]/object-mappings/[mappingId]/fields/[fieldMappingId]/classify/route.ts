// 013-migration-logic — POST classify: LLM classification preview for D2 sections

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { classify } from '@/lib/services/classification'
import { PlanNotFoundError } from '@/lib/services/plan-service'

type RouteParams = { params: Promise<{ planId: string; mappingId: string; fieldMappingId: string }> }

// POST /api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/classify
// Body: { promptText, destinationValues, sampleSourceValues }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: 'Object mapping not found.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: fieldMappingId } })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json(
        { error: 'FIELD_MAPPING_NOT_FOUND', message: 'Field mapping not found.' },
        { status: 404 },
      )
    }

    const body = await req.json()
    const { promptText, destinationValues, sampleSourceValues } = body

    if (!Array.isArray(destinationValues) || destinationValues.length === 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'destinationValues must be a non-empty array.' },
        { status: 400 },
      )
    }

    if (!Array.isArray(sampleSourceValues) || sampleSourceValues.length === 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'sampleSourceValues must be a non-empty array.' },
        { status: 400 },
      )
    }

    // Limit to 5 samples to avoid excessive LLM calls
    const samples = (sampleSourceValues as string[]).slice(0, 5)

    console.log('[classify] POST', { fieldMappingId, samplesCount: samples.length })

    const classifications = await classify(
      typeof promptText === 'string' ? promptText : '',
      destinationValues as string[],
      samples,
    )

    return NextResponse.json({ classifications })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[POST /classify]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
