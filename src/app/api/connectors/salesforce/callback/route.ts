// GET /api/connectors/salesforce/callback?code=…&state=…
// Fin du flux OAuth : échange code→tokens, crée la connexion, la lie au plan
// comme SOURCE, récupère le schéma (best-effort — le client a un filet §4.1),
// puis redirige vers la page source du plan.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  computeExpiresAt,
  exchangeCodeForTokens,
  fetchIdentity,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  SalesforceAuthError,
  takePkceVerifier,
} from "@/features/connectors/salesforce/auth";
import type { SalesforceConnectionConfig } from "@/features/connectors/salesforce/types";
import { fetchSchema, linkConnectionToPlan } from "@/features/connectors/connection-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const planId = state ? state.split(":")[0] : null;
  const base = planId ? `/plans/${planId}/source` : "/";

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${base}?connector_error=missing_params`, request.url));
  }

  const verifier = takePkceVerifier(state); // usage unique
  if (!verifier) {
    await logAuditEvent({
      action: "SF_OAUTH_FAILURE",
      entity: "ConnectorConnection",
      details: { error: "pkce_lost", state },
    });
    return NextResponse.redirect(new URL(`${base}?connector_error=pkce_lost`, request.url));
  }

  try {
    const config = loadSalesforceConfig();
    const tokens = await exchangeCodeForTokens(config, code, verifier);
    const identity = await fetchIdentity(tokens.id, tokens.access_token).catch(() => null);

    const connectionConfig: SalesforceConnectionConfig = {
      instanceUrl: tokens.instance_url,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: computeExpiresAt(tokens.issued_at),
      orgName: identity?.displayName,
      userId: identity?.userId,
    };

    const connection = await db.connectorConnection.create({
      data: {
        adapterType: "salesforce",
        name: connectionConfig.orgName ?? "Salesforce",
        config: JSON.stringify(connectionConfig),
      },
    });
    if (planId) {
      await linkConnectionToPlan(planId, "SOURCE", connection.id);
      // Best-effort : garantit connexion-avec-snapshot dès le retour ;
      // en cas d'échec, la page source relance le fetch (filet client §4.1).
      await fetchSchema(connection.id, "SOURCE").catch((error) =>
        console.warn("[sf-callback] fetch du schéma différé :", error),
      );
    }

    await logAuditEvent({
      planId: planId ?? undefined,
      action: "SF_OAUTH_SUCCESS",
      entity: "ConnectorConnection",
      entityId: connection.id,
      details: { orgName: connectionConfig.orgName },
    });
    return NextResponse.redirect(new URL(`${base}?connected=salesforce`, request.url));
  } catch (error) {
    let code = "auth_failed";
    if (error instanceof MissingSalesforceEnvError) code = "not_configured";
    else if (error instanceof SalesforceAuthError && error.providerError) code = error.providerError;

    await logAuditEvent({
      planId: planId ?? undefined,
      action: "SF_OAUTH_FAILURE",
      entity: "ConnectorConnection",
      details: { error: code, message: (error as Error).message },
    });
    return NextResponse.redirect(new URL(`${base}?connector_error=${code}`, request.url));
  }
}
