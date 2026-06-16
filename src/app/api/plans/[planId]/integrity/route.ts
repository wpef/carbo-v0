// 017-mapping-integrity-check — Route handlers (v4)
// GET  /api/plans/[planId]/integrity        — run check, return IntegrityCheckResult
// POST /api/plans/[planId]/integrity        — repair broken mappings (explicit user action, Principle IX)
// PATCH /api/plans/[planId]/integrity       — resolve a single issue (body: { issueId })
//
// Contracts: specs/017-mapping-integrity-check/contracts/api.md

import { NextResponse } from 'next/server'
import {
  checkIntegrity,
  repairBrokenMappings,
  resolveIssue,
  IssueNotFoundError,
  IssueAlreadyResolvedError,
} from '@/features/integrity/services/integrity-service'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ planId: string }> }

// ─── GET — run integrity check ─────────────────────────────────────────────────
export async function GET(_request: Request, { params }: RouteContext) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  try {
    const result = await checkIntegrity(planId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /integrity]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Integrity check failed' }, { status: 500 })
  }
}

// ─── POST — repair broken mappings (explicit user action, Principle IX) ─────────
export async function POST(_request: Request, { params }: RouteContext) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  try {
    const result = await repairBrokenMappings(planId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /integrity]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Repair failed' }, { status: 500 })
  }
}

// ─── PATCH — resolve a single issue ───────────────────────────────────────────
export async function PATCH(request: Request, { params }: RouteContext) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  let body: { issueId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'JSON body required' }, { status: 400 })
  }

  if (!body.issueId) {
    return NextResponse.json({ error: 'MISSING_ISSUE_ID', message: 'issueId is required' }, { status: 400 })
  }

  try {
    const result = await resolveIssue(planId, body.issueId)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof IssueNotFoundError) {
      return NextResponse.json({ error: 'ISSUE_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof IssueAlreadyResolvedError) {
      return NextResponse.json({ error: 'ALREADY_RESOLVED', message: err.message }, { status: 409 })
    }
    console.error('[PATCH /integrity]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Resolve failed' }, { status: 500 })
  }
}
