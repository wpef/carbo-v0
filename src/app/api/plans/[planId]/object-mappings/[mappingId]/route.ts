import { NextResponse } from 'next/server'
import { deleteObjectMapping } from '@/features/object-mapping/services/object-mapping-service'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params
  try {
    await deleteObjectMapping(planId, mappingId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
