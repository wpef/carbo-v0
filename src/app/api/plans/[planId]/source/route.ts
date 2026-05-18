import { NextResponse } from 'next/server'
import { connectSource, disconnectSource, getSourceConnection } from '@/features/source-connection/services/connect-source'
import { fetchSourceSchema } from '@/features/source-connection/services/fetch-schema'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const connection = await getSourceConnection(planId)
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
    const connection = await connectSource(planId, body.adapterType, body.config || {})
    // Auto-fetch schema after successful connection
    const snapshot = await fetchSourceSchema(planId)
    return NextResponse.json({ connection, snapshot }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    await disconnectSource(planId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Disconnect failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
