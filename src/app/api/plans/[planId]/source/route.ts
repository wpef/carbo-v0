import { NextRequest, NextResponse } from 'next/server'
import {
  getSourceConnection,
  connectSource,
  disconnectSource,
  InvalidAdapterError,
  AuthFailedError,
  SourceConnectionNotFoundError,
} from '@/lib/services/source-connection'
import { PlanNotFoundError } from '@/lib/services/plan-service'

// GET /api/plans/[planId]/source
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const connection = await getSourceConnection(planId)

    if (!connection) {
      return NextResponse.json({ id: null, status: 'NONE' })
    }

    return NextResponse.json({
      id: connection.id,
      planId: connection.planId,
      adapterType: connection.adapterType,
      status: connection.status,
      connectedAt: connection.connectedAt,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/source
export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const { adapterType, config } = body as { adapterType?: unknown; config?: unknown }

  if (!adapterType || typeof adapterType !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'adapterType is required.' }, { status: 400 })
  }

  const resolvedConfig = (config && typeof config === 'object' && !Array.isArray(config))
    ? (config as Record<string, unknown>)
    : {}

  try {
    const connection = await connectSource(planId, adapterType, resolvedConfig)

    return NextResponse.json(
      {
        id: connection.id,
        planId: connection.planId,
        adapterType: connection.adapterType,
        status: connection.status,
        connectedAt: connection.connectedAt,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof InvalidAdapterError) {
      return NextResponse.json({ error: 'INVALID_ADAPTER', message: err.message }, { status: 400 })
    }
    if (err instanceof AuthFailedError) {
      return NextResponse.json({ error: 'AUTH_FAILED', message: err.message }, { status: 401 })
    }
    console.error('[POST /source]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/source
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const result = await disconnectSource(planId)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError || err instanceof SourceConnectionNotFoundError) {
      return NextResponse.json({ error: 'NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /source]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
