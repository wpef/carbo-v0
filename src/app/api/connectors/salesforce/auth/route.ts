// POST /api/connectors/salesforce/auth
// Initiates the Salesforce OAuth2 Authorization Code flow with PKCE.
// Returns the authorization URL; the UI redirects the browser there.
// Ref: specs/adapters/salesforce/contracts/api.md

import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  storePkceVerifier,
} from '@/lib/adapters/salesforce/salesforce-auth'
import { logAuditEvent } from '@/lib/audit'

export async function POST(): Promise<NextResponse> {
  try {
    const config = loadSalesforceConfig()
    const state = randomBytes(16).toString('hex')
    const { verifier, challenge } = generatePkceChallenge()

    // Store verifier on globalThis so it survives Next.js hot-reload between /auth and /callback.
    storePkceVerifier(state, verifier)

    const authorizationUrl = buildAuthorizationUrl(config, state, challenge)

    await logAuditEvent({
      action: 'SALESFORCE_CONNECT_INITIATED',
      entity: 'ConnectorConnection',
      details: { state },
    })

    return NextResponse.json({ authorizationUrl })
  } catch (err) {
    if (err instanceof MissingSalesforceEnvError) {
      return NextResponse.json(
        { error: { code: 'SALESFORCE_NOT_CONFIGURED', message: err.message } },
        { status: 500 },
      )
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: { code: 'SALESFORCE_AUTH_FAILED', message: msg } },
      { status: 500 },
    )
  }
}
