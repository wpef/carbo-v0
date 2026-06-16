// 011-object-mapping — GET / POST /api/plans/[planId]/object-mappings
// GET: list all mappings for the plan.
// POST: create a manual mapping (sourceObjectName + destinationObjectName).
//       The legacy body.autoLink path is removed — use the /auto-link route instead.

import { NextResponse } from 'next/server'
import {
  listObjectMappings,
  createObjectMapping,
} from '@/features/object-mapping/services/object-mapping-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const mappings = await listObjectMappings(planId)
  return NextResponse.json(mappings)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const body = await request.json() as { sourceObjectName?: string; destinationObjectName?: string }

  if (!body.sourceObjectName || !body.destinationObjectName) {
    return NextResponse.json(
      { error: 'sourceObjectName and destinationObjectName sont requis' },
      { status: 400 },
    )
  }

  try {
    const { mapping, warnings } = await createObjectMapping(
      planId,
      body.sourceObjectName,
      body.destinationObjectName,
    )
    return NextResponse.json({ mapping, warnings }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Création échouée'
    // Prisma unique constraint violation
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ error: 'Ce mapping existe déjà' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
