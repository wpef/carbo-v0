// GET /api/connectors/hubspot/callback?code=…&state=…
// Fin du flux OAuth HubSpot : échange le code, valide le token (infos du
// portail), crée la connexion, la lie au plan comme DESTINATION, récupère le
// schéma (best-effort), puis redirige vers la page destination du plan.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  computeOAuthExpiresAt,
  exchangeOAuthCode,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
  validateToken,
} from "@/features/connectors/hubspot/auth";
import type { HubSpotConnectionConfig } from "@/features/connectors/hubspot/types";
import { fetchSchema, linkConnectionToPlan } from "@/features/connectors/connection-service";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");
  const planId = state ? state.split(":")[0] : null;
  const base = planId ? `/plans/${planId}/destination` : "/";

  if (providerError) {
    const description = request.nextUrl.searchParams.get("error_description") ?? providerError;
    await logAuditEvent({
      planId: planId ?? undefined,
      action: "HS_OAUTH_DENIED",
      entity: "MigrationPlan",
      entityId: planId ?? undefined,
      details: { error: providerError, description },
    });
    return NextResponse.redirect(
      new URL(`${base}?connector_error=${encodeURIComponent(description)}`, request.url),
    );
  }
  if (!code || !state || !planId) {
    return NextResponse.redirect(new URL(`${base}?connector_error=missing_params`, request.url));
  }

  try {
    const config = loadHubSpotOAuthConfig();
    const tokens = await exchangeOAuthCode(config, code);
    const portal = await validateToken(tokens.access_token);

    const connectionConfig: HubSpotConnectionConfig = {
      authMethod: "oauth2",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: computeOAuthExpiresAt(tokens.expires_in),
      portalId: portal.portalId,
      portalName: portal.portalName,
    };
    const connection = await db.connectorConnection.create({
      data: {
        adapterType: "hubspot",
        name: portal.portalName ?? `HubSpot portail ${portal.portalId}`,
        config: JSON.stringify(connectionConfig),
      },
    });
    await linkConnectionToPlan(planId, "DESTINATION", connection.id);
    await fetchSchema(connection.id, "DESTINATION").catch((error) =>
      console.warn("[hs-callback] fetch du schéma différé :", error),
    );

    await logAuditEvent({
      planId,
      action: "HS_OAUTH_SUCCESS",
      entity: "ConnectorConnection",
      entityId: connection.id,
      details: { portalId: portal.portalId },
    });
    return NextResponse.redirect(new URL(`${base}?connected=hubspot`, request.url));
  } catch (error) {
    const code =
      error instanceof MissingHubSpotEnvError
        ? "not_configured"
        : error instanceof HubSpotAuthError
          ? encodeURIComponent(error.message)
          : "auth_failed";
    await logAuditEvent({
      planId,
      action: "HS_OAUTH_FAILURE",
      entity: "MigrationPlan",
      entityId: planId,
      details: { message: (error as Error).message },
    });
    return NextResponse.redirect(new URL(`${base}?connector_error=${code}`, request.url));
  }
}
