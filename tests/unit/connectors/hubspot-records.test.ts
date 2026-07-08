// Tests unitaires — HubSpot records (Search API paginée) — port v4 → v5.
// searchRecords / mapToConnectorRecords / countRecords.
// calculateFieldStats (per-field v4) est absent de v5 → non porté.
//
// Changements v4 → v5 :
//  - import ../hubspot-records → @/features/connectors/hubspot/records.
//  - message d'erreur français "Recherche HubSpot en échec" au lieu de
//    "HubSpot search failed" — sémantique (lève sur erreur API) inchangée.
// fetch est stubé ; aucun appel réseau réel.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchRecords,
  mapToConnectorRecords,
  countRecords,
} from "@/features/connectors/hubspot/records";

// Réinitialise le cache de curseurs global entre les tests.
beforeEach(() => {
  globalThis.__hsCursorStore = undefined;
});

const MOCK_TOKEN = "test-token";
const MOCK_SCOPE = "conn-001";
const MOCK_OBJECT = "contacts";

function makeSearchResponse(total: number, count: number, nextAfter?: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      total,
      results: Array.from({ length: count }, (_, i) => ({
        id: `rec-${i + 1}`,
        properties: { firstname: `User ${i + 1}`, email: `user${i + 1}@test.com` },
      })),
      paging: nextAfter ? { next: { after: nextAfter } } : undefined,
    }),
  };
}

describe("searchRecords", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns paginated records for page 1", async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(50, 10, "cursor-p2"));

    const result = await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, ["firstname"], 1, 10);

    expect(result.records).toHaveLength(10);
    expect(result.totalCount).toBe(50);
    expect(result.currentPage).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.hasNextPage).toBe(true);
  });

  it("flattens { id, properties } into a flat record", async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(1, 1));

    const result = await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10);
    const record = result.records[0];
    expect(record.id).toBe("rec-1");
    expect(record.firstname).toBe("User 1");
  });

  it("uses the stored cursor for page 2", async () => {
    // Page 1 — peuple le cache de curseurs.
    fetchMock.mockResolvedValueOnce(makeSearchResponse(20, 10, "cursor-for-p2"));
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10);

    // Page 2 — doit utiliser le curseur.
    fetchMock.mockResolvedValueOnce(makeSearchResponse(20, 10));
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 2, 10);

    const [, p2Init] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(p2Init.body as string);
    expect(body.after).toBe("cursor-for-p2");
  });

  it("caps pageSize at 100", async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(5, 5));
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 9999);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.limit).toBe(100);
  });

  it("throws on API error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" });
    await expect(searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10)).rejects.toThrow(
      "Recherche HubSpot en échec",
    );
  });

  // Régression (revue adversariale tranche 3) : une page au-delà de la
  // dernière ne doit JAMAIS renvoyer les données de la page 1 étiquetées
  // comme la page demandée — elle renvoie une page VIDE (fidélité, Principe
  // III ; cohérent avec SF/démo).
  it("returns an EMPTY page (not page 1's data) when the requested page is out of range", async () => {
    // 2 pages réelles (150 enregistrements, pageSize 100) ; on demande la page 5.
    fetchMock
      .mockResolvedValueOnce(makeSearchResponse(150, 100, "cursor-p2")) // page 1 → curseur p2
      .mockResolvedValueOnce(makeSearchResponse(150, 50)); // page 2 → pas de curseur (dernière)

    const result = await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 5, 100);

    expect(result.records).toEqual([]);
    expect(result.currentPage).toBe(5);
    expect(result.totalCount).toBe(150);
    expect(result.hasNextPage).toBe(false);
    // Exactement 2 appels (la marche s'arrête à la dernière page), aucun
    // appel sans curseur qui aurait ramené la page 1.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("mapToConnectorRecords", () => {
  it("merges id and properties into a flat object", () => {
    const results = [
      { id: "r1", properties: { name: "Alice", email: "alice@test.com" } },
      { id: "r2", properties: { name: "Bob", email: "bob@test.com" } },
    ];
    const records = mapToConnectorRecords(results);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ id: "r1", name: "Alice", email: "alice@test.com" });
    expect(records[1]).toEqual({ id: "r2", name: "Bob", email: "bob@test.com" });
  });

  it("handles empty results", () => {
    expect(mapToConnectorRecords([])).toEqual([]);
  });
});

describe("countRecords", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the total from a limit=1 search", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ total: 1234, results: [{ id: "r1", properties: {} }] }),
    });

    const count = await countRecords(MOCK_TOKEN, MOCK_OBJECT);
    expect(count).toBe(1234);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.limit).toBe(1);
  });
});
