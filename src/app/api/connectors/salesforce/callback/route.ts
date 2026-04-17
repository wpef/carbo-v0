// GET /api/connectors/salesforce/callback?code=...&state=...
// Completes the OAuth2+PKCE flow: exchange code, fetch identity, persist connection.
// Ref: specs/adapters/salesforce/ (T005)

import { NextRequest, NextResponse } from 'next/server'
import {
  computeExpiresAt,
  exchangeCodeForTokens,
  fetchIdentity,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  SalesforceAuthError,
  takePkceVerifier,
} from '@/lib/connectors/salesforce/salesforce-auth'
import type { SalesforceConnectionConfig } from '@/lib/connectors/salesforce/salesforce-types'
import { upsertSourceConnectionRaw } from '@/lib/services/source-connection'
import { logAction } from '@/lib/services/audit-service'

function errorRedirect(origin: string, planId: string | null, message: string): NextResponse {
  const base = planId ? `/plans/${planId}/source` : '/'
  return NextResponse.redirect(`${origin}${base}?connector_error=${encodeURIComponent(message)}`)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const providerError = req.nextUrl.searchParams.get('error')
  const providerErrorDesc = req.nextUrl.searchParams.get('error_description')

  // Salesforce returns the user on the callback URL with ?error=... if they declined auth.
  if (providerError) {
    await logAction(null, 'SF_OAUTH_DENIED', { error: providerError, description: providerErrorDesc })
    const planId = state?.split(':')[0] ?? null
    return errorRedirect(new URL(req.url).origin, planId, providerErrorDesc ?? providerError)
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'MISSING_PARAMS', message: 'code and state query parameters are required.' },
      { status: 400 },
    )
  }

  const planId = state.split(':')[0]
  if (!planId) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: 'state is malformed.' },
      { status: 400 },
    )
  }

  const verifier = takePkceVerifier(state)
  if (!verifier) {
    await logAction(planId, 'SF_OAUTH_VERIFIER_LOST', { state })
    return errorRedirect(new URL(req.url).origin, planId, 'PKCE verifier lost — please retry the connection.')
  }

  let config
  try {
    config = loadSalesforceConfig()
  } catch (err) {
    if (err instanceof MissingSalesforceEnvError) {
      await logAction(planId, 'SF_OAUTH_ENV_MISSING', { message: err.message })
      return errorRedirect(new URL(req.url).origin, planId, err.message)
    }
    throw err
  }

  let tokens
  try {
    tokens = await exchangeCodeForTokens(config, code, verifier)
  } catch (err) {
    const message = err instanceof SalesforceAuthError ? err.message : 'Token exchange failed.'
    await logAction(planId, 'SF_OAUTH_EXCHANGE_FAILED', { message })
    return errorRedirect(new URL(req.url).origin, planId, message)
  }

  // Best-effort identity fetch — non-fatal if it fails (the connection is still usable).
  const identity: { displayName?: string; userId?: string; orgId?: string } = await fetchIdentity(
    tokens.id,
    tokens.access_token,
  ).catch(() => ({}))

  const connectionConfig: SalesforceConnectionConfig = {
    instanceUrl: tokens.instance_url,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: computeExpiresAt(tokens.issued_at),
    orgName: identity.displayName,
    userId: identity.userId,
  }

  try {
    await upsertSourceConnectionRaw(
      planId,
      'salesforce',
      connectionConfig as unknown as Record<string, unknown>,
      'CONNECTED',
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Persistence failed.'
    await logAction(planId, 'SF_OAUTH_PERSIST_FAILED', { message })
    return errorRedirect(new URL(req.url).origin, planId, message)
  }

  await logAction(planId, 'SF_OAUTH_SUCCESS', {
    instanceUrl: tokens.instance_url,
    orgName: identity.displayName,
  })

  // Redirect back to the source page with a success flag.
  return NextResponse.redirect(`${new URL(req.url).origin}/plans/${planId}/source?connected=salesforce`)
}
