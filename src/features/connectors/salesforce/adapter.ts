// Adaptateur Salesforce — implémente ConnectorAdapter via jsforce v3 (port v4).
// Source uniquement (le sens SF→HubSpot est le périmètre de la phase 1).

import jsforce from "jsforce";
import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { ConnectorAdapter, ConnectorFieldDef, ConnectorObjectDef } from "../contract";
import {
  computeExpiresAt,
  loadSalesforceConfig,
  refreshAccessToken,
  SalesforceAuthError,
} from "./auth";
import { mapDescribeGlobalToObjects, mapDescribeToFields, type DescribeResult } from "./schema";
import { buildCountQuery, buildSoqlQuery, executeQuery, type SoqlQueryResult } from "./records";
import {
  SF_API_VERSION,
  SF_DEFAULT_CRM_OBJECTS,
  SF_SYSTEM_EXACT_NAMES,
  SF_SYSTEM_PREFIXES,
  SF_SYSTEM_SUFFIXES,
} from "./constants";
import type { SalesforceConnectionConfig } from "./types";

// --- Tokens : lecture du config persisté + refresh transparent ---

async function loadConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
  const record = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!record) throw new Error(`Connexion introuvable : ${connectionId}`);
  return JSON.parse(record.config) as SalesforceConnectionConfig;
}

function isExpired(c: SalesforceConnectionConfig): boolean {
  return !c.tokenExpiresAt || new Date(c.tokenExpiresAt).getTime() <= Date.now();
}

/**
 * Garantit un access token valide : si expiré et qu'un refresh_token existe,
 * refresh transparent + persistance de la nouvelle paire.
 */
async function getValidConfig(connectionId: string): Promise<SalesforceConnectionConfig> {
  const c = await loadConfig(connectionId);
  if (!isExpired(c)) return c;

  if (!c.refreshToken) {
    throw new SalesforceAuthError("Token expiré et aucun refresh_token disponible.");
  }
  const app = loadSalesforceConfig();
  const refreshed = await refreshAccessToken(app, c.refreshToken);
  const next: SalesforceConnectionConfig = {
    ...c,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? c.refreshToken,
    tokenExpiresAt: computeExpiresAt(refreshed.issued_at),
    instanceUrl: refreshed.instance_url ?? c.instanceUrl,
  };
  await db.connectorConnection.update({
    where: { id: connectionId },
    data: { config: JSON.stringify(next) },
  });
  await logAuditEvent({
    action: "SF_TOKEN_REFRESHED",
    entity: "ConnectorConnection",
    entityId: connectionId,
  });
  return next;
}

async function getJsforceConnection(connectionId: string) {
  const c = await getValidConfig(connectionId);
  return new jsforce.Connection({
    instanceUrl: c.instanceUrl,
    accessToken: c.accessToken,
    version: SF_API_VERSION,
  });
}

// --- Adaptateur ---

export const salesforceAdapter: ConnectorAdapter = {
  descriptor: {
    type: "salesforce",
    label: "Salesforce",
    description: "Connexion OAuth à votre org Salesforce (source)",
    sides: ["SOURCE"],
    connectMode: "oauth",
  },
  capabilities: { canRead: true, canWrite: false, canWriteSchema: false, canPreviewRecords: true },
  objectMetadata: {
    defaultSelectedObjects: SF_DEFAULT_CRM_OBJECTS,
    systemExactNames: SF_SYSTEM_EXACT_NAMES,
    systemPrefixes: SF_SYSTEM_PREFIXES,
    systemSuffixes: SF_SYSTEM_SUFFIXES,
  },

  async getObjects(connectionId: string): Promise<ConnectorObjectDef[]> {
    const conn = await getJsforceConnection(connectionId);
    const result = await conn.describeGlobal();
    const objects = mapDescribeGlobalToObjects(result.sobjects);
    await logAuditEvent({
      action: "SF_SCHEMA_FETCHED",
      entity: "ConnectorConnection",
      entityId: connectionId,
      details: { objectCount: objects.length },
    });
    return objects;
  },

  async getFields(connectionId: string, objectApiName: string): Promise<ConnectorFieldDef[]> {
    const conn = await getJsforceConnection(connectionId);
    const describe = (await conn.describe(objectApiName)) as unknown as DescribeResult;
    return mapDescribeToFields(describe);
  },

  async getRecords(connectionId, objectApiName, page, pageSize) {
    const conn = await getJsforceConnection(connectionId);
    // Colonnes = champs accessibles du describe (l'objet peut ne pas être
    // dans le snapshot ; on interroge SF directement).
    const describe = (await conn.describe(objectApiName)) as unknown as DescribeResult;
    const fieldNames = mapDescribeToFields(describe)
      .filter((f) => f.isAccessible)
      .map((f) => f.apiName);
    const query = (soql: string) => conn.query(soql) as unknown as Promise<SoqlQueryResult>;
    const total = await query(buildCountQuery(objectApiName));
    return executeQuery(
      { query },
      buildSoqlQuery(objectApiName, fieldNames, page, pageSize),
      page,
      pageSize,
      total.totalSize,
    );
  },
  async getRecordCount(connectionId, objectApiName) {
    const conn = await getJsforceConnection(connectionId);
    const result = (await conn.query(buildCountQuery(objectApiName))) as unknown as SoqlQueryResult;
    return result.totalSize;
  },
};
