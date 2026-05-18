import { NextResponse } from 'next/server'
import { connectDestination, disconnectDestination, getDestinationConnection } from '@/features/destination-connection/services/connect-destination'
import { fetchDestinationSchema } from '@/features/destination-connection/services/fetch-dest-schema'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const connection = await getDestinationConnection(planId)
  if (!connection) return NextResponse.json(null)
  return NextResponse.json(connection)
}

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()
  if (!body.adapterType) {
    return NextResponse.json({ error: 'adapterType is required' }, { status: 400 })
  }
  try {
    const connection = await connectDestination(planId, body.adapterType, body.config || {})
    const snapshot = await fetchDestinationSchema(planId)
    return NextResponse.json({ connection, snapshot }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    await disconnectDestination(planId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Disconnect failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
