import { NextResponse } from 'next/server'
import { listObjectMappings, createObjectMapping, autoLinkObjects } from '@/features/object-mapping/services/object-mapping-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const mappings = await listObjectMappings(planId)
  return NextResponse.json(mappings)
}

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()

  if (body.autoLink) {
    try {
      const result = await autoLinkObjects(planId)
      return NextResponse.json(result, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auto-link failed'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  if (!body.sourceObjectName || !body.destinationObjectName) {
    return NextResponse.json({ error: 'sourceObjectName and destinationObjectName required' }, { status: 400 })
  }

  try {
    const mapping = await createObjectMapping(planId, body.sourceObjectName, body.destinationObjectName)
    return NextResponse.json(mapping, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Creation failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
