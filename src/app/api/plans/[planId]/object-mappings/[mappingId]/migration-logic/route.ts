import { NextResponse } from 'next/server'
import { getMigrationLogic, saveMigrationLogic } from '@/features/field-mapping/services/migration-logic-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  await params
  const url = new URL(request.url)
  const fieldMappingId = url.searchParams.get('fieldMappingId')
  if (!fieldMappingId) {
    return NextResponse.json({ error: 'fieldMappingId required' }, { status: 400 })
  }

  const logic = await getMigrationLogic(fieldMappingId)
  return NextResponse.json(logic)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId } = await params
  const body = await request.json()

  if (!body.fieldMappingId || !body.status) {
    return NextResponse.json({ error: 'fieldMappingId and status required' }, { status: 400 })
  }

  try {
    const logic = await saveMigrationLogic(planId, body.fieldMappingId, {
      status: body.status,
      config: body.config,
      description: body.description,
      equivalences: body.equivalences,
    })
    return NextResponse.json(logic)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
