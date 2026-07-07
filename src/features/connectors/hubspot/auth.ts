// HubSpot auth — validation de token Private App + flux OAuth2 (port v4).

import { HS_API_BASE, HS_AUTHORIZE_URL, HS_ENV_KEYS, HS_OAUTH_SCOPES, HS_TOKEN_URL } from "./constants";
import type { HubSpotOAuthConfig, HubSpotPortalInfo, HubSpotTokenResponse } from "./types";

export class MissingHubSpotEnvError extends Error {
  constructor(missing: string[]) {
    super(`Variables d'environnement HubSpot manquantes : ${missing.join(", ")}`);
    this.name = "MissingHubSpotEnvError";
  }
}

export class HubSpotAuthError extends Error {
  constructor(
    message: string,
    public readonly providerError?: string,
  ) {
    super(message);
    this.name = "HubSpotAuthError";
  }
}

/** Charge la config OAuth2 depuis process.env (utilisée seulement en mode OAuth). */
export function loadHubSpotOAuthConfig(): HubSpotOAuthConfig {
  const clientId = process.env[HS_ENV_KEYS.clientId];
  const clientSecret = process.env[HS_ENV_KEYS.clientSecret];
  const callbackUrl = process.env[HS_ENV_KEYS.callbackUrl];

  const missing: string[] = [];
  if (!clientId) missing.push(HS_ENV_KEYS.clientId);
  if (!clientSecret) missing.push(HS_ENV_KEYS.clientSecret);
  if (!callbackUrl) missing.push(HS_ENV_KEYS.callbackUrl);
  if (missing.length > 0) throw new MissingHubSpotEnvError(missing);

  return { clientId: clientId!, clientSecret: clientSecret!, callbackUrl: callbackUrl! };
}

/**
 * Valide un token (Private App OU OAuth) via /account-info/v3/details.
 * Retourne les infos du portail ; throw HubSpotAuthError sur 401.
 */
export async function validateToken(accessToken: string): Promise<HubSpotPortalInfo> {
  const res = await fetch(`${HS_API_BASE}/account-info/v3/details`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (res.status === 401) {
    throw new HubSpotAuthError("Token HubSpot invalide ou révoqué.");
  }
  if (!res.ok) {
    const body = (await safeJson(res)) as { message?: string; category?: string } | undefined;
    throw new HubSpotAuthError(
      `Validation du token HubSpot échouée (${res.status}) : ${body?.message ?? res.statusText}`,
      body?.category,
    );
  }

  const data = (await res.json()) as {
    portalId?: number;
    accountType?: string;
    timeZone?: string;
    companyCurrency?: string;
  };
  if (!data.portalId) {
    throw new HubSpotAuthError("La validation du token n'a pas retourné de portalId.");
  }
  return {
    portalId: data.portalId,
    accountType: data.accountType,
    timeZone: data.timeZone,
    companyCurrency: data.companyCurrency,
  };
}

/** URL d'autorisation OAuth2 (redirection navigateur). */
export function buildOAuthUrl(config: HubSpotOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: HS_OAUTH_SCOPES,
    state,
  });
  return `${HS_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeOAuthCode(
  config: HubSpotOAuthConfig,
  code: string,
): Promise<HubSpotTokenResponse> {
  return postTokenEndpoint({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    code,
  });
}

export async function refreshOAuthToken(
  config: HubSpotOAuthConfig,
  refreshToken: string,
): Promise<HubSpotTokenResponse> {
  return postTokenEndpoint({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}

async function postTokenEndpoint(params: Record<string, string>): Promise<HubSpotTokenResponse> {
  const res = await fetch(HS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = (await safeJson(res)) as { message?: string; status?: string } | undefined;
    throw new HubSpotAuthError(
      `Échec OAuth HubSpot (${res.status}) : ${body?.message ?? res.statusText}`,
      body?.status,
    );
  }
  return (await res.json()) as HubSpotTokenResponse;
}

/** Expiration ISO d'un access_token OAuth frais (moins 2 min de marge). */
export function computeOAuthExpiresAt(expiresInSeconds: number, now: Date = new Date()): string {
  const safetyMs = 2 * 60 * 1000;
  return new Date(now.getTime() + expiresInSeconds * 1000 - safetyMs).toISOString();
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
