// GET /api/connectors/hubspot/callback?code=...&state=...
// Completes HubSpot OAuth2 flow: exchange code, fetch portal info, persist destination.
// Ref: specs/adapters/hubspot/ (T005)

import { NextRequest, NextResponse } from 'next/server'
import {
  computeOAuthExpiresAt,
  exchangeOAuthCode,
  fetchPortalInfo,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
} from '@/lib/connectors/hubspot/hubspot-auth'
import type { HubSpotConnectionConfig } from '@/lib/connectors/hubspot/hubspot-types'
import { upsertDestinationConnectionRaw } from '@/lib/services/destination-connection.service'
import { logAction } from '@/lib/services/audit-service'

function errorRedirect(origin: string, planId: string | null, message: string): NextResponse {
  const base = planId ? `/plans/${planId}/destination` : '/'
  return NextResponse.redirect(`${origin}${base}?connector_error=${encodeURIComponent(message)}`)
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const providerError = req.nextUrl.searchParams.get('error')
  const providerErrorDesc = req.nextUrl.searchParams.get('error_description')

  if (providerError) {
    const planId = state?.split(':')[0] ?? null
    await logAction(planId, 'HS_OAUTH_DENIED', { error: providerError, description: providerErrorDesc })
    return errorRedirect(origin, planId, providerErrorDesc ?? providerError)
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'MISSING_PARAMS', message: 'code and state are required.' },
      { status: 400 },
    )
  }

  const planId = state.split(':')[0]
  if (!planId) {
    return NextResponse.json({ error: 'INVALID_STATE', message: 'state is malformed.' }, { status: 400 })
  }

  let config
  try {
    config = loadHubSpotOAuthConfig()
  } catch (err) {
    if (err instanceof MissingHubSpotEnvError) {
      await logAction(planId, 'HS_OAUTH_ENV_MISSING', { message: err.message })
      return errorRedirect(origin, planId, err.message)
    }
    throw err
  }

  let tokens
  try {
    tokens = await exchangeOAuthCode(config, code)
  } catch (err) {
    const message = err instanceof HubSpotAuthError ? err.message : 'Token exchange failed.'
    await logAction(planId, 'HS_OAUTH_EXCHANGE_FAILED', { message })
    return errorRedirect(origin, planId, message)
  }

  // Validate the freshly issued token and fetch portal info.
  let portal
  try {
    portal = await fetchPortalInfo(tokens.access_token)
  } catch (err) {
    const message = err instanceof HubSpotAuthError ? err.message : 'Portal info fetch failed.'
    await logAction(planId, 'HS_OAUTH_PORTAL_FAILED', { message })
    return errorRedirect(origin, planId, message)
  }

  const connectionConfig: HubSpotConnectionConfig = {
    authMethod: 'oauth2',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: computeOAuthExpiresAt(tokens.expires_in),
    portalId: portal.portalId,
    portalName: portal.portalName,
  }

  try {
    await upsertDestinationConnectionRaw(
      planId,
      'hubspot',
      connectionConfig as unknown as Record<string, unknown>,
      'CONNECTED',
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Persistence failed.'
    await logAction(planId, 'HS_OAUTH_PERSIST_FAILED', { message })
    return errorRedirect(origin, planId, message)
  }

  await logAction(planId, 'HS_OAUTH_SUCCESS', { portalId: portal.portalId })

  return NextResponse.redirect(`${origin}/plans/${planId}/destination?connected=hubspot`)
}
