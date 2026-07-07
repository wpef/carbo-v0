// /api/connectors/hubspot/auth
// GET  ?planId=…                → initie le flux OAuth2 (redirection HubSpot)
// POST { planId, accessToken }  → valide un token Private App et connecte la
//                                 destination (chemin sans OAuth — utile quand
//                                 l'app OAuth n'est pas approuvée côté compte).

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildOAuthUrl,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
  validateToken,
} from "@/features/connectors/hubspot/auth";
import type { HubSpotConnectionConfig } from "@/features/connectors/hubspot/types";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { fetchSchema, linkConnectionToPlan } from "@/features/connectors/connection-service";

export async function GET(request: NextRequest) {
  const planId = request.nextUrl.searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "planId est requis" }, { status: 400 });
  }
  const base = `/plans/${planId}/destination`;

  try {
    const config = loadHubSpotOAuthConfig();
    const state = `${planId}:${randomBytes(16).toString("hex")}`;
    await logAuditEvent({
      planId,
      action: "HS_OAUTH_INITIATED",
      entity: "MigrationPlan",
      entityId: planId,
    });
    return NextResponse.redirect(buildOAuthUrl(config, state));
  } catch (error) {
    const code =
      error instanceof MissingHubSpotEnvError
        ? "not_configured"
        : encodeURIComponent((error as Error).message);
    return NextResponse.redirect(new URL(`${base}?connector_error=${code}`, request.url));
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { planId, accessToken } = body as { planId?: string; accessToken?: string };
  if (typeof planId !== "string" || planId === "") {
    return NextResponse.json({ error: "planId est requis" }, { status: 400 });
  }
  if (typeof accessToken !== "string" || accessToken === "") {
    return NextResponse.json({ error: "accessToken est requis" }, { status: 400 });
  }

  let portal;
  try {
    portal = await validateToken(accessToken);
  } catch (error) {
    const message =
      error instanceof HubSpotAuthError ? error.message : "La validation du token a échoué.";
    await logAuditEvent({
      planId,
      action: "HS_PRIVATE_APP_INVALID",
      entity: "MigrationPlan",
      entityId: planId,
      details: { message },
    });
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const connectionConfig: HubSpotConnectionConfig = {
    authMethod: "private-app",
    accessToken,
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
    console.warn("[hs-private-app] fetch du schéma différé :", error),
  );

  await logAuditEvent({
    planId,
    action: "HS_PRIVATE_APP_CONNECTED",
    entity: "ConnectorConnection",
    entityId: connection.id,
    details: { portalId: portal.portalId },
  });
  return NextResponse.json({ connection: { id: connection.id, name: connection.name } }, { status: 201 });
}
