// 011-object-mapping — T007: POST /api/plans/[planId]/object-mappings/auto-link
// One-shot auto-link endpoint. Returns AutoLinkResult.
// Idempotent: if objectAutoLinkedAt IS NOT NULL, returns alreadyLinkedAt (no-op).

import { NextResponse } from 'next/server'
import { autoLinkObjects } from '@/features/object-mapping/services/object-mapping-service'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  try {
    const result = await autoLinkObjects(planId)
    return NextResponse.json({ result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Auto-link failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
