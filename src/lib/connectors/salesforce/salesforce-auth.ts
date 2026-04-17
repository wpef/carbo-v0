// Salesforce OAuth2 + PKCE — pure functions, no network I/O except token exchange
// Ref: specs/adapters/salesforce/ (T003) + spec Gotchas section

import { randomBytes, createHash } from 'node:crypto'
import {
  SF_API_VERSION,
  SF_DEFAULT_LOGIN_URL,
  SF_ENV_KEYS,
  SF_OAUTH_SCOPE,
} from './salesforce-constants'
import type {
  PkceChallenge,
  SalesforceConfig,
  SalesforceTokenResponse,
} from './salesforce-types'

// --- Errors ---

export class MissingSalesforceEnvError extends Error {
  constructor(missing: string[]) {
    super(`Missing Salesforce env vars: ${missing.join(', ')}`)
    this.name = 'MissingSalesforceEnvError'
  }
}

export class SalesforceAuthError extends Error {
  constructor(message: string, public readonly providerError?: string) {
    super(message)
    this.name = 'SalesforceAuthError'
  }
}

// --- Config loader ---

/** Load SalesforceConfig from process.env. Throws MissingSalesforceEnvError if any required var is absent. */
export function loadSalesforceConfig(): SalesforceConfig {
  const clientId = process.env[SF_ENV_KEYS.clientId]
  const clientSecret = process.env[SF_ENV_KEYS.clientSecret]
  const callbackUrl = process.env[SF_ENV_KEYS.callbackUrl]
  const loginUrl = process.env[SF_ENV_KEYS.loginUrl] ?? SF_DEFAULT_LOGIN_URL

  const missing: string[] = []
  if (!clientId) missing.push(SF_ENV_KEYS.clientId)
  if (!clientSecret) missing.push(SF_ENV_KEYS.clientSecret)
  if (!callbackUrl) missing.push(SF_ENV_KEYS.callbackUrl)
  if (missing.length > 0) throw new MissingSalesforceEnvError(missing)

  return { clientId: clientId!, clientSecret: clientSecret!, callbackUrl: callbackUrl!, loginUrl }
}

// --- PKCE helpers ---

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate a PKCE challenge pair (verifier + S256-derived challenge).
 * Verifier: 43-128 char base64url string (we use 64 bytes → 86 chars).
 */
export function generatePkceChallenge(): PkceChallenge {
  const verifier = base64UrlEncode(randomBytes(64))
  const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// --- PKCE store (survives Next.js hot-reload in dev) ---

/**
 * PKCE store pinned to `globalThis` so the code_verifier survives the hot-reload
 * that happens between /auth (init) and /callback in Next.js dev mode.
 * Keyed by the OAuth `state` value.
 */
declare global {

  var __sfPkceStore: Map<string, string> | undefined
}
function getPkceStore(): Map<string, string> {
  if (!globalThis.__sfPkceStore) globalThis.__sfPkceStore = new Map<string, string>()
  return globalThis.__sfPkceStore
}

export function storePkceVerifier(state: string, verifier: string): void {
  getPkceStore().set(state, verifier)
}

export function takePkceVerifier(state: string): string | undefined {
  const store = getPkceStore()
  const v = store.get(state)
  store.delete(state) // single-use
  return v
}

// --- Authorization URL ---

/**
 * Build the Salesforce OAuth2 authorize URL with PKCE (S256).
 * The browser redirects here; the consultant logs in; SF redirects back to `callbackUrl`.
 */
export function buildAuthorizationUrl(
  config: SalesforceConfig,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: SF_OAUTH_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${config.loginUrl}/services/oauth2/authorize?${params.toString()}`
}

// --- Token exchange (direct HTTP POST, NOT jsforce) ---

/**
 * Exchange an authorization code for tokens via direct HTTP POST.
 *
 * Per spec "Implementation Gotchas": jsforce's OAuth2.authorize() does NOT
 * accept a code_verifier parameter, so we MUST post manually to
 * `{loginUrl}/services/oauth2/token`.
 */
export async function exchangeCodeForTokens(
  config: SalesforceConfig,
  code: string,
  codeVerifier: string,
): Promise<SalesforceTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    code_verifier: codeVerifier,
  })

  const res = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })

  if (!res.ok) {
    const errBody = (await safeJson(res)) as { error?: string; error_description?: string } | undefined
    throw new SalesforceAuthError(
      `Token exchange failed (${res.status}): ${errBody?.error_description ?? errBody?.error ?? res.statusText}`,
      errBody?.error,
    )
  }
  return (await res.json()) as SalesforceTokenResponse
}

// --- Refresh token ---

export async function refreshAccessToken(
  config: SalesforceConfig,
  refreshToken: string,
): Promise<SalesforceTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  })

  const res = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })

  if (!res.ok) {
    const errBody = (await safeJson(res)) as { error?: string; error_description?: string } | undefined
    throw new SalesforceAuthError(
      `Refresh failed (${res.status}): ${errBody?.error_description ?? errBody?.error ?? res.statusText}`,
      errBody?.error,
    )
  }
  return (await res.json()) as SalesforceTokenResponse
}

// --- Identity endpoint (fetch org name) ---

/**
 * Fetch human-readable identity info for the connected user/org.
 * The `id` URL returned by the token endpoint points to `/id/<orgId>/<userId>`.
 * Appending `?version=<api>` returns JSON with `display_name`, `organization_id`, etc.
 */
export async function fetchIdentity(
  idUrl: string,
  accessToken: string,
): Promise<{ displayName?: string; userId?: string; orgId?: string }> {
  const res = await fetch(`${idUrl}?version=${SF_API_VERSION}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return {}
  const data = (await res.json()) as {
    display_name?: string
    user_id?: string
    organization_id?: string
  }
  return { displayName: data.display_name, userId: data.user_id, orgId: data.organization_id }
}

// --- Token expiration helper ---

/** Compute the ISO expiration timestamp for a fresh SF access_token (~30 min window, with 2 min safety buffer). */
export function computeExpiresAt(issuedAt?: string): string {
  // SF's issued_at is a ms-since-epoch string; fall back to "now" if not provided.
  const issuedMs = issuedAt ? Number(issuedAt) : Date.now()
  const safetyWindowMs = 2 * 60 * 1000
  const ttlMs = 30 * 60 * 1000
  return new Date(issuedMs + ttlMs - safetyWindowMs).toISOString()
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}
