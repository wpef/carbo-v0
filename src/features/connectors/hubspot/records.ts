// HubSpot — Search API paginée (porté de v4).
// L'API est à CURSEURS, pas à offsets : on adapte en mémorisant le curseur
// de chaque page sur globalThis (survit au hot-reload dev) et en re-marchant
// depuis la page 1 sur cache froid.

import { HS_API_BASE } from "./constants";
import type { PaginatedRecords } from "../contract";

interface HsSearchResponse {
  total: number;
  results: Array<{
    id: string;
    properties: Record<string, unknown>;
  }>;
  paging?: { next?: { after?: string } };
}

declare global {
  // eslint-disable-next-line no-var
  var __hsCursorStore: Map<string, string> | undefined;
}
function cursorStore(): Map<string, string> {
  if (!globalThis.__hsCursorStore) globalThis.__hsCursorStore = new Map();
  return globalThis.__hsCursorStore;
}
function cursorKey(scope: string, objectType: string, page: number): string {
  return `${scope}::${objectType}::${page}`;
}

async function callSearch(
  accessToken: string,
  objectType: string,
  properties: string[],
  limit: number,
  after: string | undefined,
): Promise<HsSearchResponse> {
  const body: Record<string, unknown> = {
    properties: properties.length > 0 ? properties : undefined,
    limit,
  };
  if (after) body.after = after;

  const res = await fetch(`${HS_API_BASE}/crm/v3/objects/${encodeURIComponent(objectType)}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Recherche HubSpot en échec (${res.status}) sur ${objectType}: ${res.statusText}`);
  }
  return (await res.json()) as HsSearchResponse;
}

/** Aplatit { id, properties } en un seul objet. */
export function mapToConnectorRecords(
  results: HsSearchResponse["results"],
): Record<string, unknown>[] {
  return results.map((r) => ({ id: r.id, ...r.properties }));
}

/**
 * Page d'enregistrements d'un objet HubSpot. `page` est 1-indexée ;
 * `scope` identifie la connexion (clé du cache de curseurs).
 */
export async function searchRecords(
  accessToken: string,
  scope: string,
  objectType: string,
  properties: string[],
  page: number,
  pageSize: number,
): Promise<PaginatedRecords> {
  const limit = Math.max(1, Math.min(100, Math.floor(pageSize))); // max Search API : 100
  const pageNum = Math.max(1, Math.floor(page));

  const store = cursorStore();
  let after: string | undefined;
  if (pageNum > 1) {
    after = store.get(cursorKey(scope, objectType, pageNum));
    if (!after) {
      // Cache froid : re-marche depuis la page 1 pour reconstruire les curseurs.
      let cursor: string | undefined;
      let lastTotal = 0;
      for (let i = 1; i < pageNum; i++) {
        const r = await callSearch(accessToken, objectType, properties, limit, cursor);
        lastTotal = r.total;
        cursor = r.paging?.next?.after;
        if (!cursor) break; // page (i+1) inexistante → page demandée hors borne
        store.set(cursorKey(scope, objectType, i + 1), cursor);
      }
      after = store.get(cursorKey(scope, objectType, pageNum));
      // Page au-delà de la dernière : page VIDE, jamais les données de la
      // page 1 étiquetées comme la page demandée (fidélité — Principe III ;
      // cohérent avec les adaptateurs SF/démo qui renvoient une page vide).
      if (!after) {
        return {
          records: [],
          totalCount: lastTotal,
          pageSize: limit,
          currentPage: pageNum,
          hasNextPage: false,
        };
      }
    }
  }

  const data = await callSearch(accessToken, objectType, properties, limit, after);
  const nextCursor = data.paging?.next?.after;
  if (nextCursor) store.set(cursorKey(scope, objectType, pageNum + 1), nextCursor);

  return {
    records: mapToConnectorRecords(data.results),
    totalCount: data.total,
    pageSize: limit,
    currentPage: pageNum,
    hasNextPage: Boolean(nextCursor),
  };
}

/** Total d'un objet : un search limit=1 renvoie le total dans la même réponse. */
export async function countRecords(accessToken: string, objectType: string): Promise<number> {
  const r = await callSearch(accessToken, objectType, [], 1, undefined);
  return r.total;
}
