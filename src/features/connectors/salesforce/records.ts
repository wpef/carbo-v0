// Salesforce — construction SOQL + exécution paginée (porté de v4).
// Fonctions pures sauf executeQuery (qui reçoit la connexion jsforce).

import type { PaginatedRecords } from "../contract";

/** Garde un identifiant contre l'injection SOQL (lettres/chiffres/underscore). */
export function safeIdent(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Identifiant SF invalide : ${value}`);
  return value;
}

/**
 * SOQL avec LIMIT/OFFSET. `page` est 1-indexée (page=1 → OFFSET 0).
 * Salesforce plafonne OFFSET à 2000 → erreur explicite au-delà (jamais de
 * troncature silencieuse).
 */
export function buildSoqlQuery(
  objectApiName: string,
  fieldApiNames: string[],
  page: number,
  pageSize: number,
): string {
  const obj = safeIdent(objectApiName);
  const fields = fieldApiNames.length === 0 ? ["Id"] : fieldApiNames.map(safeIdent);
  const pageNum = Math.max(1, Math.floor(page));
  const size = Math.max(1, Math.min(200, Math.floor(pageSize)));
  const offset = (pageNum - 1) * size;
  if (offset > 2000) {
    throw new Error(`SALESFORCE_OFFSET_EXCEEDED: OFFSET ${offset} dépasse la limite Salesforce de 2000.`);
  }
  return `SELECT ${fields.join(", ")} FROM ${obj} LIMIT ${size} OFFSET ${offset}`;
}

/** Requête COUNT() pour le total. */
export function buildCountQuery(objectApiName: string): string {
  return `SELECT COUNT() FROM ${safeIdent(objectApiName)}`;
}

/** Vue étroite du résultat jsforce dont on dépend. */
export interface SoqlQueryResult {
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
}

/** Retire l'enveloppe `attributes` de jsforce d'un record. */
function stripAttributes(record: Record<string, unknown>): Record<string, unknown> {
  const { attributes: _attributes, ...rest } = record as { attributes?: unknown } & Record<
    string,
    unknown
  >;
  return rest;
}

/** Exécute une SOQL et met le résultat en forme PaginatedRecords. */
export async function executeQuery(
  conn: { query: (soql: string) => Promise<SoqlQueryResult> },
  soql: string,
  page: number,
  pageSize: number,
  totalCountHint?: number,
): Promise<PaginatedRecords> {
  const result = await conn.query(soql);
  const totalCount = totalCountHint ?? result.totalSize;
  return {
    records: (result.records ?? []).map(stripAttributes),
    totalCount,
    pageSize,
    currentPage: page,
    hasNextPage: page * pageSize < totalCount,
  };
}
