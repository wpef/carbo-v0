// GET /api/connectors/salesforce/auth?planId=...
// Initiates the Salesforce OAuth2 Authorization Code flow with PKCE and redirects
// the browser to the Salesforce authorization URL. planId is carried in the OAuth
// `state` (planId:nonce) so the callback can link the connection to the plan.
// Ref: specs/adapters/salesforce/contracts/api.md

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  storePkceVerifier,
} from '@/lib/adapters/salesforce/salesforce-auth'
import { logAuditEvent } from '@/lib/audit'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const planId = req.nextUrl.searchParams.get('planId')
  if (!planId) {
    return NextResponse.json(
      { error: 'MISSING_PLAN_ID', message: 'planId query parameter is required.' },
      { status: 400 },
    )
  }

  const base = `/plans/${planId}/source`
  try {
    const config = loadSalesforceConfig()
    const nonce = randomBytes(16).toString('hex')
    const state = `${planId}:${nonce}`
    const { verifier, challenge } = generatePkceChallenge()

    // Store verifier on globalThis (keyed by state) so it survives hot-reload between /auth and /callback.
    storePkceVerifier(state, verifier)

    const authorizationUrl = buildAuthorizationUrl(config, state, challenge)

    await logAuditEvent({
      planId,
      action: 'SALESFORCE_CONNECT_INITIATED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { state },
    })

    return NextResponse.redirect(authorizationUrl)
  } catch (err) {
    if (err instanceof MissingSalesforceEnvError) {
      return NextResponse.redirect(new URL(`${base}?error=not_configured`, req.url))
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(new URL(`${base}?error=${encodeURIComponent(msg)}`, req.url))
  }
}
