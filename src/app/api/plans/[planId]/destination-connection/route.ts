// 006-destination-connection — API Route: GET / POST / DELETE

import { NextResponse } from 'next/server'
import {
  connectDestination,
  disconnectDestination,
  getDestinationConnection,
  DestinationAlreadyConnectedError,
  DestinationNotConnectedError,
  DestinationConnectionFailedError,
} from '@/lib/services/destination-connection.service'
import { PlanNotFoundError } from '@/lib/services/plan-service'

type RouteContext = { params: Promise<{ planId: string }> }

// ---------------------------------------------------------------------------
// GET /api/plans/[planId]/destination-connection
// Returns the current destination connection status, or null if not connected.
// ---------------------------------------------------------------------------
export async function GET(_request: Request, { params }: RouteContext) {
  const { planId } = await params

  try {
    const connection = await getDestinationConnection(planId)
    return NextResponse.json({ connection })
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[destination-connection] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/plans/[planId]/destination-connection
// Connect a destination adapter to the plan.
// Body: { adapterType: string, config?: Record<string, unknown> }
// ---------------------------------------------------------------------------
export async function POST(request: Request, { params }: RouteContext) {
  const { planId } = await params

  let body: { adapterType?: string; config?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { adapterType, config = {} } = body

  if (!adapterType || typeof adapterType !== 'string') {
    return NextResponse.json({ error: 'adapterType is required' }, { status: 400 })
  }

  try {
    const connection = await connectDestination(planId, adapterType, config)
    return NextResponse.json({ connection }, { status: 201 })
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof DestinationAlreadyConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof DestinationConnectionFailedError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('[destination-connection] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/plans/[planId]/destination-connection
// Disconnect and cascade-delete all destination data.
// ---------------------------------------------------------------------------
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { planId } = await params

  try {
    const result = await disconnectDestination(planId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof DestinationNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('[destination-connection] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
