// /api/connectors/hubspot/auth
// GET  ?planId=...        -> initiate OAuth2 flow (redirect to HubSpot)
// POST { planId, accessToken } -> validate a Private App token and persist the destination connection
// Ref: specs/adapters/hubspot/

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import {
  buildOAuthUrl,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
  validatePrivateAppToken,
} from '@/lib/adapters/hubspot/hubspot-auth'
import type { HubSpotConnectionConfig } from '@/lib/adapters/hubspot/hubspot-types'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

// --- GET: initiate OAuth2 ---

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
    config = loadHubSpotOAuthConfig()
  } catch (err) {
    if (err instanceof MissingHubSpotEnvError) {
      return NextResponse.json({ error: 'MISSING_ENV', message: err.message }, { status: 500 })
    }
    throw err
  }

  const nonce = randomBytes(16).toString('hex')
  const state = `${planId}:${nonce}`
  const url = buildOAuthUrl(config, state)

  await logAuditEvent({
    planId,
    action: 'HS_OAUTH_INIT',
    entity: 'MigrationPlan',
    entityId: planId,
    details: { callbackUrl: config.callbackUrl },
  })

  return NextResponse.redirect(url)
}

// --- POST: validate a Private App token and persist the destination ---

export async function POST(req: NextRequest) {
  let body: { planId?: unknown; accessToken?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  const { planId, accessToken } = body
  if (!planId || typeof planId !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'planId is required.' }, { status: 400 })
  }
  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'accessToken is required.' },
      { status: 400 },
    )
  }

  let portal
  try {
    portal = await validatePrivateAppToken(accessToken)
  } catch (err) {
    const message = err instanceof HubSpotAuthError ? err.message : 'Token validation failed.'
    await logAuditEvent({
      planId,
      action: 'HS_PRIVATE_APP_INVALID',
      entity: 'MigrationPlan',
      entityId: planId,
      details: { message },
    })
    return NextResponse.json({ error: 'AUTH_FAILED', message }, { status: 401 })
  }

  const connectionConfig: HubSpotConnectionConfig = {
    authMethod: 'private-app',
    accessToken,
    portalId: portal.portalId,
    portalName: portal.portalName,
  }

  try {
    // Upsert ConnectorConnection for v4 schema (adapterType, name, status, config)
    const plan = await prisma.migrationPlan.findUnique({
      where: { id: planId },
      include: { destinationConnection: true },
    })
    if (!plan) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Plan not found.' }, { status: 404 })
    }

    let connection
    if (plan.destinationConnectionId && plan.destinationConnection) {
      // Update existing connection
      connection = await prisma.connectorConnection.update({
        where: { id: plan.destinationConnectionId },
        data: {
          adapterType: 'hubspot',
          name: portal.portalName ?? `HubSpot portal ${portal.portalId}`,
          status: 'CONNECTED',
          config: JSON.stringify(connectionConfig),
        },
      })
    } else {
      // Create new connection and link to plan
      connection = await prisma.connectorConnection.create({
        data: {
          adapterType: 'hubspot',
          name: portal.portalName ?? `HubSpot portal ${portal.portalId}`,
          status: 'CONNECTED',
          config: JSON.stringify(connectionConfig),
          destinationPlan: { connect: { id: planId } },
        },
      })
    }

    await logAuditEvent({
      planId,
      action: 'HS_PRIVATE_APP_CONNECTED',
      entity: 'ConnectorConnection',
      entityId: connection.id,
      details: { portalId: portal.portalId },
    })
    return NextResponse.json(
      {
        id: connection.id,
        planId,
        adapterType: connection.adapterType,
        status: connection.status,
        createdAt: connection.createdAt,
        portalId: portal.portalId,
        portalName: portal.portalName,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Persistence failed.'
    return NextResponse.json({ error: 'INTERNAL_ERROR', message }, { status: 500 })
  }
}
