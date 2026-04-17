// GET /api/connectors/salesforce/auth?planId=...
// Starts the OAuth2+PKCE flow and redirects the browser to Salesforce.
// Ref: specs/adapters/salesforce/ (T004)

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  storePkceVerifier,
} from '@/lib/connectors/salesforce/salesforce-auth'
import { logAction } from '@/lib/services/audit-service'

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get('planId')
  if (!planId) {
    return NextResponse.json(
      { error: 'MISSING_PLAN_ID', message: 'planId query parameter is required.' },
      { status: 400 },
    )
  }

  let config
  try {
    config = loadSalesforceConfig()
  } catch (err) {
    if (err instanceof MissingSalesforceEnvError) {
      return NextResponse.json(
        { error: 'MISSING_ENV', message: err.message },
        { status: 500 },
      )
    }
    throw err
  }

  // State = <planId>:<nonce> so the callback can identify the plan and verify anti-CSRF.
  const nonce = randomBytes(16).toString('hex')
  const state = `${planId}:${nonce}`

  const { verifier, challenge } = generatePkceChallenge()
  storePkceVerifier(state, verifier)

  const authUrl = buildAuthorizationUrl(config, state, challenge)

  await logAction(planId, 'SF_OAUTH_INIT', {
    loginUrl: config.loginUrl,
    callbackUrl: config.callbackUrl,
  })

  return NextResponse.redirect(authUrl)
}
