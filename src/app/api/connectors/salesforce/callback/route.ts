// GET /api/connectors/salesforce/callback?code={code}&state={state}
// OAuth2 callback: exchanges the authorization code for tokens, creates ConnectorConnection.
// Redirects to /plans/{planId}/source?connected=salesforce on success.
// Ref: specs/adapters/salesforce/contracts/api.md

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import {
  computeExpiresAt,
  exchangeCodeForTokens,
  fetchIdentity,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  SalesforceAuthError,
  takePkceVerifier,
} from '@/lib/adapters/salesforce/salesforce-auth'
import type { SalesforceConnectionConfig } from '@/lib/adapters/salesforce/salesforce-types'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const planId = state ? state.split(':')[0] : null // planId is embedded in the OAuth state (planId:nonce)

  // Basic redirect target (fallback if planId unknown)
  const baseRedirect = planId ? `/plans/${planId}/source` : '/'

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${baseRedirect}?error=missing_params`, request.url))
  }

  // Retrieve and consume the PKCE verifier (single-use).
  const verifier = takePkceVerifier(state)
  if (!verifier) {
    await logAuditEvent({
      action: 'SALESFORCE_CONNECT_FAILURE',
      entity: 'ConnectorConnection',
      details: { error: 'pkce_lost', state },
    })
    return NextResponse.redirect(new URL(`${baseRedirect}?error=pkce_lost`, request.url))
  }

  try {
    const config = loadSalesforceConfig()
    const tokens = await exchangeCodeForTokens(config, code, verifier)

    // Fetch org name for human-readable connection label.
    const identity = await fetchIdentity(tokens.id, tokens.access_token).catch(() => null)

    const connectionConfig: SalesforceConnectionConfig = {
      instanceUrl: tokens.instance_url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: computeExpiresAt(tokens.issued_at),
      orgName: identity?.displayName,
      userId: identity?.userId,
    }

    // Upsert the ConnectorConnection record (v4 Prisma model).
    // We use upsert on (adapterType, planId-side) — but since the model has no planId directly,
    // we create a fresh connection. The source connection API route will link it to the plan.
    const connection = await prisma.connectorConnection.create({
      data: {
        adapterType: 'salesforce',
        name: connectionConfig.orgName ?? 'Salesforce',
        status: 'CONNECTED',
        config: JSON.stringify(connectionConfig),
      },
    })

    // Link the connection to the plan as its SOURCE (planId comes from the OAuth state).
    if (planId) {
      await prisma.migrationPlan.update({
        where: { id: planId },
        data: { sourceConnectionId: connection.id },
      })
    }

    await logAuditEvent({
      action: 'SALESFORCE_CONNECT_SUCCESS',
      entity: 'ConnectorConnection',
      entityId: connection.id,
      details: { orgName: connectionConfig.orgName, userId: connectionConfig.userId },
    })

    const redirectUrl = planId
      ? `${baseRedirect}?connected=salesforce&connectionId=${connection.id}`
      : `/?connected=salesforce&connectionId=${connection.id}`

    return NextResponse.redirect(new URL(redirectUrl, request.url))
  } catch (err) {
    let errorCode = 'auth_failed'
    if (err instanceof MissingSalesforceEnvError) {
      errorCode = 'not_configured'
    } else if (err instanceof SalesforceAuthError) {
      const providerError = err.providerError
      if (providerError === 'invalid_grant') errorCode = 'invalid_grant'
      else if (providerError === 'invalid_client_id') errorCode = 'invalid_client'
    }

    await logAuditEvent({
      action: 'SALESFORCE_CONNECT_FAILURE',
      entity: 'ConnectorConnection',
      details: { error: errorCode, message: err instanceof Error ? err.message : String(err) },
    })

    return NextResponse.redirect(new URL(`${baseRedirect}?error=${errorCode}`, request.url))
  }
}
