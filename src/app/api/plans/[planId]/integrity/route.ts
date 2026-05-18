import { NextResponse } from 'next/server'
import { runIntegrityCheck, getUnresolvedIssues, resolveIssue } from '@/features/integrity/services/integrity-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const issues = await getUnresolvedIssues(planId)
  return NextResponse.json(issues)
}

export async function POST(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    const result = await runIntegrityCheck(planId)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Integrity check failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()
  if (!body.issueId) {
    return NextResponse.json({ error: 'issueId required' }, { status: 400 })
  }

  try {
    await resolveIssue(planId, body.issueId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Resolve failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
