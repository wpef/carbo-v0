// Adaptateur HubSpot — implémente ConnectorAdapter (port v4).
// Destination uniquement (le sens SF→HubSpot est le périmètre de la phase 1).
// Deux méthodes d'auth : OAuth2 (refresh transparent) ou Private App (token statique).

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { ConnectorAdapter, ConnectorFieldDef, ConnectorObjectDef } from "../contract";
import { computeOAuthExpiresAt, loadHubSpotOAuthConfig, refreshOAuthToken } from "./auth";
import { getCustomObjects, getProperties, getStandardObjects } from "./schema";
import { HS_STANDARD_OBJECTS } from "./constants";
import type { HubSpotConnectionConfig } from "./types";

// --- Tokens : lecture du config persisté + refresh transparent (OAuth seulement) ---

async function loadConfig(connectionId: string): Promise<HubSpotConnectionConfig> {
  const record = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!record) throw new Error(`Connexion introuvable : ${connectionId}`);
  return JSON.parse(record.config) as HubSpotConnectionConfig;
}

async function getValidAccessToken(connectionId: string): Promise<string> {
  const c = await loadConfig(connectionId);
  // Private App : token statique, rien à rafraîchir.
  if (c.authMethod === "private-app") return c.accessToken;

  const expired = !c.tokenExpiresAt || new Date(c.tokenExpiresAt).getTime() <= Date.now();
  if (!expired) return c.accessToken;

  const app = loadHubSpotOAuthConfig();
  const refreshed = await refreshOAuthToken(app, c.refreshToken);
  const next: HubSpotConnectionConfig = {
    ...c,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt: computeOAuthExpiresAt(refreshed.expires_in),
  };
  await db.connectorConnection.update({
    where: { id: connectionId },
    data: { config: JSON.stringify(next) },
  });
  await logAuditEvent({
    action: "HS_TOKEN_REFRESHED",
    entity: "ConnectorConnection",
    entityId: connectionId,
  });
  return next.accessToken;
}

// --- Adaptateur ---

export const hubspotAdapter: ConnectorAdapter = {
  descriptor: {
    type: "hubspot",
    label: "HubSpot",
    description: "Connexion OAuth ou token Private App à votre portail HubSpot (destination)",
    sides: ["DESTINATION"],
    connectMode: "oauth-or-token",
  },
  capabilities: { canRead: true, canWrite: false, canWriteSchema: true },
  objectMetadata: {
    defaultSelectedObjects: HS_STANDARD_OBJECTS.map((o) => o.apiName),
    systemExactNames: [],
    systemPrefixes: [],
    systemSuffixes: [],
  },

  async getObjects(connectionId: string): Promise<ConnectorObjectDef[]> {
    const token = await getValidAccessToken(connectionId);
    const standard = getStandardObjects();
    // Les objets custom peuvent échouer (tier) sans invalider le connecteur.
    const custom = await getCustomObjects(token).catch((error) => {
      console.warn("[hubspot] lecture des objets custom échouée, on continue en standard :", error);
      return [] as ConnectorObjectDef[];
    });
    const objects = [...standard, ...custom];
    await logAuditEvent({
      action: "HS_SCHEMA_FETCHED",
      entity: "ConnectorConnection",
      entityId: connectionId,
      details: { standardCount: standard.length, customCount: custom.length },
    });
    return objects;
  },

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorFieldDef[]> {
    const token = await getValidAccessToken(connectionId);
    return getProperties(token, objectApiName);
  },
};
