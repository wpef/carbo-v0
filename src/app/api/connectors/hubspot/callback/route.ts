// GET /api/connectors/hubspot/callback?code=...&state=...
// Completes HubSpot OAuth2 flow: exchange code, fetch portal info, persist connection.
// Ref: specs/adapters/hubspot/

import { NextRequest, NextResponse } from 'next/server'
import {
  computeOAuthExpiresAt,
  exchangeOAuthCode,
  fetchPortalInfo,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
} from '@/lib/adapters/hubspot/hubspot-auth'
import type { HubSpotConnectionConfig } from '@/lib/adapters/hubspot/hubspot-types'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

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
    await logAuditEvent({
      planId: planId ?? undefined,
      action: 'HS_OAUTH_DENIED',
      entity: 'MigrationPlan',
      entityId: planId ?? undefined,
      details: { error: providerError, description: providerErrorDesc },
    })
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
      await logAuditEvent({
        planId,
        action: 'HS_OAUTH_ENV_MISSING',
        entity: 'MigrationPlan',
        entityId: planId,
        details: { message: err.message },
      })
      return errorRedirect(origin, planId, err.message)
    }
    throw err
  }

  let tokens
  try {
    tokens = await exchangeOAuthCode(config, code)
  } catch (err) {
    const message = err instanceof HubSpotAuthError ? err.message : 'Token exchange failed.'
    await logAuditEvent({
      planId,
      action: 'HS_OAUTH_EXCHANGE_FAILED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { message },
    })
    return errorRedirect(origin, planId, message)
  }

  // Validate the freshly issued token and fetch portal info.
  let portal
  try {
    portal = await fetchPortalInfo(tokens.access_token)
  } catch (err) {
    const message = err instanceof HubSpotAuthError ? err.message : 'Portal info fetch failed.'
    await logAuditEvent({
      planId,
      action: 'HS_OAUTH_PORTAL_FAILED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { message },
    })
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
    // Upsert ConnectorConnection for v4 schema
    const plan = await prisma.migrationPlan.findUnique({
      where: { id: planId },
      include: { destinationConnection: true },
    })
    if (!plan) {
      return errorRedirect(origin, planId, 'Plan not found.')
    }

    if (plan.destinationConnectionId && plan.destinationConnection) {
      await prisma.connectorConnection.update({
        where: { id: plan.destinationConnectionId },
        data: {
          adapterType: 'hubspot',
          name: portal.portalName ?? `HubSpot portal ${portal.portalId}`,
          status: 'CONNECTED',
          config: JSON.stringify(connectionConfig),
        },
      })
    } else {
      await prisma.connectorConnection.create({
        data: {
          adapterType: 'hubspot',
          name: portal.portalName ?? `HubSpot portal ${portal.portalId}`,
          status: 'CONNECTED',
          config: JSON.stringify(connectionConfig),
          destinationPlan: { connect: { id: planId } },
        },
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Persistence failed.'
    await logAuditEvent({
      planId,
      action: 'HS_OAUTH_PERSIST_FAILED',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { message },
    })
    return errorRedirect(origin, planId, message)
  }

  await logAuditEvent({
    planId,
    action: 'HS_OAUTH_SUCCESS',
    entity: 'MigrationPlan',
    entityId: planId,
    details: { portalId: portal.portalId },
  })

  return NextResponse.redirect(`${origin}/plans/${planId}/destination?connected=hubspot`)
}
