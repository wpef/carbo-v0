// GET /api/connectors/salesforce/auth?planId=…
// Initie le flux OAuth2 + PKCE et redirige le navigateur vers Salesforce.
// planId voyage dans le `state` OAuth (planId:nonce) pour que le callback
// sache à quel plan rattacher la connexion.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  loadSalesforceConfig,
  MissingSalesforceEnvError,
  storePkceVerifier,
} from "@/features/connectors/salesforce/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const planId = request.nextUrl.searchParams.get("planId");
  if (!planId) {
    return NextResponse.json({ error: "planId est requis" }, { status: 400 });
  }

  const base = `/plans/${planId}/source`;
  try {
    const config = loadSalesforceConfig();
    const state = `${planId}:${randomBytes(16).toString("hex")}`;
    const { verifier, challenge } = generatePkceChallenge();
    // Le verifier doit survivre au hot-reload entre /auth et /callback (store globalThis).
    storePkceVerifier(state, verifier);

    await logAuditEvent({
      planId,
      action: "SF_OAUTH_INITIATED",
      entity: "MigrationPlan",
      entityId: planId,
    });
    return NextResponse.redirect(buildAuthorizationUrl(config, state, challenge));
  } catch (error) {
    const code =
      error instanceof MissingSalesforceEnvError
        ? "not_configured"
        : encodeURIComponent((error as Error).message);
    return NextResponse.redirect(new URL(`${base}?connector_error=${code}`, request.url));
  }
}
