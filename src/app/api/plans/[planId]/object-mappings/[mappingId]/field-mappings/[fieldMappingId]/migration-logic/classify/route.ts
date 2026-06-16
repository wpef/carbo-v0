// 013-migration-logic — POST /classify: LLM classification preview for D2 sections
// Route: /api/plans/[planId]/object-mappings/[mappingId]/field-mappings/[fieldMappingId]/migration-logic/classify
//
// Stateless — does not persist. Returns classifications array.
// Stub deterministic classifier until ANTHROPIC_API_KEY + real Claude call are wired.
// TODO: replace classify-service stub with real Claude API call (see classify-service.ts).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classify } from '@/features/migration-logic/services/classify-service'

type RouteParams = {
  params: Promise<{ planId: string; mappingId: string; fieldMappingId: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    // Ownership validation
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'Object mapping introuvable.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: fieldMappingId } })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json({ error: 'Field mapping introuvable.' }, { status: 404 })
    }

    const body = await req.json() as {
      prompt?: string
      destinationValues?: string[]
      sampleSourceValues?: string[]
    }

    const { prompt, destinationValues, sampleSourceValues } = body

    if (!Array.isArray(destinationValues) || destinationValues.length === 0) {
      return NextResponse.json(
        { error: 'destinationValues doit être un tableau non vide.' },
        { status: 400 },
      )
    }

    if (!Array.isArray(sampleSourceValues) || sampleSourceValues.length === 0) {
      return NextResponse.json(
        { error: 'sampleSourceValues doit être un tableau non vide.' },
        { status: 400 },
      )
    }

    const samples = (sampleSourceValues as string[]).slice(0, 5)

    const classifications = await classify(
      typeof prompt === 'string' ? prompt : '',
      destinationValues as string[],
      samples,
    )

    return NextResponse.json({ classifications })
  } catch (err) {
    console.error('[POST /classify]', err)
    return NextResponse.json(
      { error: 'Classification unavailable — check LLM configuration' },
      { status: 503 },
    )
  }
}
