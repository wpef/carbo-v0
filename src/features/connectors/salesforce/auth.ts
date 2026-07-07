// Salesforce OAuth2 + PKCE — fonctions pures, aucun I/O réseau sauf les
// échanges de tokens (port v4, validé en recette réelle).
//
// Gotcha documenté : jsforce OAuth2.authorize() n'accepte PAS de
// code_verifier — l'échange de code DOIT être un POST manuel sur
// {loginUrl}/services/oauth2/token.

import { createHash, randomBytes } from "node:crypto";
import { SF_API_VERSION, SF_DEFAULT_LOGIN_URL, SF_ENV_KEYS, SF_OAUTH_SCOPE } from "./constants";
import type { PkceChallenge, SalesforceConfig, SalesforceTokenResponse } from "./types";

export class MissingSalesforceEnvError extends Error {
  constructor(missing: string[]) {
    super(`Variables d'environnement Salesforce manquantes : ${missing.join(", ")}`);
    this.name = "MissingSalesforceEnvError";
  }
}

export class SalesforceAuthError extends Error {
  constructor(
    message: string,
    public readonly providerError?: string,
  ) {
    super(message);
    this.name = "SalesforceAuthError";
  }
}

/** Charge la config de la Connected App depuis process.env (throw si incomplète). */
export function loadSalesforceConfig(): SalesforceConfig {
  const clientId = process.env[SF_ENV_KEYS.clientId];
  const clientSecret = process.env[SF_ENV_KEYS.clientSecret];
  const callbackUrl = process.env[SF_ENV_KEYS.callbackUrl];
  const loginUrl = process.env[SF_ENV_KEYS.loginUrl] ?? SF_DEFAULT_LOGIN_URL;

  const missing: string[] = [];
  if (!clientId) missing.push(SF_ENV_KEYS.clientId);
  if (!clientSecret) missing.push(SF_ENV_KEYS.clientSecret);
  if (!callbackUrl) missing.push(SF_ENV_KEYS.callbackUrl);
  if (missing.length > 0) throw new MissingSalesforceEnvError(missing);

  return { clientId: clientId!, clientSecret: clientSecret!, callbackUrl: callbackUrl!, loginUrl };
}

// --- PKCE ---

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Paire PKCE (verifier 86 chars base64url + challenge S256). */
export function generatePkceChallenge(): PkceChallenge {
  const verifier = base64UrlEncode(randomBytes(64));
  const challenge = base64UrlEncode(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/**
 * Store PKCE épinglé sur `globalThis` : le code_verifier doit survivre au
 * hot-reload Next.js entre /auth et /callback en dev. Clé = state OAuth.
 */
declare global {
  // eslint-disable-next-line no-var
  var __sfPkceStore: Map<string, string> | undefined;
}

function getPkceStore(): Map<string, string> {
  if (!globalThis.__sfPkceStore) globalThis.__sfPkceStore = new Map<string, string>();
  return globalThis.__sfPkceStore;
}

export function storePkceVerifier(state: string, verifier: string): void {
  getPkceStore().set(state, verifier);
}

/** Récupération À USAGE UNIQUE du verifier. */
export function takePkceVerifier(state: string): string | undefined {
  const store = getPkceStore();
  const verifier = store.get(state);
  store.delete(state);
  return verifier;
}

// --- Flux OAuth ---

/** URL d'autorisation SF (redirection navigateur, PKCE S256). */
export function buildAuthorizationUrl(
  config: SalesforceConfig,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: SF_OAUTH_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${config.loginUrl}/services/oauth2/authorize?${params.toString()}`;
}

/** Échange code → tokens (POST manuel, cf. gotcha jsforce en tête de fichier). */
export async function exchangeCodeForTokens(
  config: SalesforceConfig,
  code: string,
  codeVerifier: string,
): Promise<SalesforceTokenResponse> {
  return postTokenEndpoint(config, {
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    code_verifier: codeVerifier,
  });
}

export async function refreshAccessToken(
  config: SalesforceConfig,
  refreshToken: string,
): Promise<SalesforceTokenResponse> {
  return postTokenEndpoint(config, {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}

async function postTokenEndpoint(
  config: SalesforceConfig,
  params: Record<string, string>,
): Promise<SalesforceTokenResponse> {
  const res = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = (await safeJson(res)) as { error?: string; error_description?: string } | undefined;
    throw new SalesforceAuthError(
      `Échec OAuth Salesforce (${res.status}) : ${body?.error_description ?? body?.error ?? res.statusText}`,
      body?.error,
    );
  }
  return (await res.json()) as SalesforceTokenResponse;
}

/** Identité lisible de l'org/utilisateur connecté (l'URL `id` vient du token endpoint). */
export async function fetchIdentity(
  idUrl: string,
  accessToken: string,
): Promise<{ displayName?: string; userId?: string; orgId?: string }> {
  const res = await fetch(`${idUrl}?version=${SF_API_VERSION}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as {
    display_name?: string;
    user_id?: string;
    organization_id?: string;
  };
  return { displayName: data.display_name, userId: data.user_id, orgId: data.organization_id };
}

/** Expiration ISO d'un access_token frais (~30 min, moins 2 min de marge). */
export function computeExpiresAt(issuedAt?: string): string {
  const issuedMs = issuedAt ? Number(issuedAt) : Date.now();
  const safetyWindowMs = 2 * 60 * 1000;
  const ttlMs = 30 * 60 * 1000;
  return new Date(issuedMs + ttlMs - safetyWindowMs).toISOString();
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
