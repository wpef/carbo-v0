// HubSpot auth — Private App token validation + OAuth2 code flow (v4 port)
// Ref: specs/adapters/hubspot/

import {
  HS_API_BASE,
  HS_AUTHORIZE_URL,
  HS_ENV_KEYS,
  HS_OAUTH_SCOPES,
  HS_TOKEN_URL,
} from './hubspot-constants'
import type {
  HubSpotOAuthConfig,
  HubSpotPortalInfo,
  HubSpotTokenResponse,
} from './hubspot-types'

// --- Errors ---

export class MissingHubSpotEnvError extends Error {
  constructor(missing: string[]) {
    super(`Missing HubSpot env vars: ${missing.join(', ')}`)
    this.name = 'MissingHubSpotEnvError'
  }
}

export class HubSpotAuthError extends Error {
  constructor(message: string, public readonly providerError?: string) {
    super(message)
    this.name = 'HubSpotAuthError'
  }
}

// --- Config loader ---

/** Load HubSpot OAuth2 config from process.env. Used only when the user picks OAuth2. */
export function loadHubSpotOAuthConfig(): HubSpotOAuthConfig {
  const clientId = process.env[HS_ENV_KEYS.clientId]
  const clientSecret = process.env[HS_ENV_KEYS.clientSecret]
  const callbackUrl = process.env[HS_ENV_KEYS.callbackUrl]

  const missing: string[] = []
  if (!clientId) missing.push(HS_ENV_KEYS.clientId)
  if (!clientSecret) missing.push(HS_ENV_KEYS.clientSecret)
  if (!callbackUrl) missing.push(HS_ENV_KEYS.callbackUrl)
  if (missing.length > 0) throw new MissingHubSpotEnvError(missing)

  return { clientId: clientId!, clientSecret: clientSecret!, callbackUrl: callbackUrl! }
}

// --- Private App validation ---

/**
 * Validate a Private App access token by calling /account-info/v3/details.
 * Returns portal information on success; throws HubSpotAuthError on 401/403.
 */
export async function validatePrivateAppToken(accessToken: string): Promise<HubSpotPortalInfo> {
  const res = await fetch(`${HS_API_BASE}/account-info/v3/details`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (res.status === 401) {
    throw new HubSpotAuthError('Invalid or revoked Private App token.')
  }
  if (!res.ok) {
    const body = (await safeJson(res)) as { message?: string; category?: string } | undefined
    throw new HubSpotAuthError(
      `HubSpot token validation failed (${res.status}): ${body?.message ?? res.statusText}`,
      body?.category,
    )
  }

  const data = (await res.json()) as {
    portalId?: number
    accountType?: string
    timeZone?: string
    companyCurrency?: string
  }
  if (!data.portalId) {
    throw new HubSpotAuthError('Token validation returned no portalId.')
  }
  return {
    portalId: data.portalId,
    accountType: data.accountType,
    timeZone: data.timeZone,
    companyCurrency: data.companyCurrency,
  }
}

// --- OAuth2 authorization URL ---

export function buildOAuthUrl(config: HubSpotOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: HS_OAUTH_SCOPES,
    state,
  })
  return `${HS_AUTHORIZE_URL}?${params.toString()}`
}

// --- Token exchange ---

export async function exchangeOAuthCode(
  config: HubSpotOAuthConfig,
  code: string,
): Promise<HubSpotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    code,
  })

  const res = await fetch(HS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const errBody = (await safeJson(res)) as { message?: string; status?: string } | undefined
    throw new HubSpotAuthError(
      `Token exchange failed (${res.status}): ${errBody?.message ?? res.statusText}`,
      errBody?.status,
    )
  }
  return (await res.json()) as HubSpotTokenResponse
}

// --- Refresh token ---

export async function refreshOAuthToken(
  config: HubSpotOAuthConfig,
  refreshToken: string,
): Promise<HubSpotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  })
  const res = await fetch(HS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  if (!res.ok) {
    const errBody = (await safeJson(res)) as { message?: string; status?: string } | undefined
    throw new HubSpotAuthError(
      `Refresh failed (${res.status}): ${errBody?.message ?? res.statusText}`,
      errBody?.status,
    )
  }
  return (await res.json()) as HubSpotTokenResponse
}

// --- Fetch portal info with any valid token (OAuth or Private App) ---

export async function fetchPortalInfo(accessToken: string): Promise<HubSpotPortalInfo> {
  return validatePrivateAppToken(accessToken)
}

/** Compute the ISO expiration for a fresh OAuth access_token (subtract 2min safety buffer). */
export function computeOAuthExpiresAt(expiresInSeconds: number, now: Date = new Date()): string {
  const safetyMs = 2 * 60 * 1000
  return new Date(now.getTime() + expiresInSeconds * 1000 - safetyMs).toISOString()
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}
