// Tests unitaires — Salesforce records (SOQL + exécution paginée) — port v4 → v5.
// EXTRAITS du gros test d'adaptateur v4 (salesforce.test.ts) : uniquement
// safeIdent / buildSoqlQuery / buildCountQuery / executeQuery.
// calculateFieldStats (per-field v4) est absent de v5 → non porté.
//
// Changements v4 → v5 :
//  - import ./salesforce-records → @/features/connectors/salesforce/records.
//  - safeIdent lève désormais un message français ("Identifiant SF invalide :")
//    au lieu de "Invalid SF identifier" — sémantique (lève sur injection) inchangée.
// Aucun appel réseau réel : executeQuery reçoit un stub conn.query.

import { describe, it, expect, vi } from "vitest";
import {
  safeIdent,
  buildSoqlQuery,
  buildCountQuery,
  executeQuery,
} from "@/features/connectors/salesforce/records";

describe("safeIdent", () => {
  it("allows valid identifiers", () => {
    expect(safeIdent("Contact")).toBe("Contact");
    expect(safeIdent("Invoice__c")).toBe("Invoice__c");
  });

  it("throws on identifier with injection chars", () => {
    expect(() => safeIdent("Contact; DROP TABLE--")).toThrow("Identifiant SF invalide");
    expect(() => safeIdent("Contact WHERE 1=1")).toThrow("Identifiant SF invalide");
  });
});

describe("buildSoqlQuery", () => {
  it("generates correct SOQL for page 1", () => {
    const soql = buildSoqlQuery("Contact", ["Id", "FirstName"], 1, 25);
    expect(soql).toBe("SELECT Id, FirstName FROM Contact LIMIT 25 OFFSET 0");
  });

  it("generates correct OFFSET for page 2", () => {
    const soql = buildSoqlQuery("Contact", ["Id"], 2, 25);
    expect(soql).toBe("SELECT Id FROM Contact LIMIT 25 OFFSET 25");
  });

  it("defaults to Id when no fields given", () => {
    const soql = buildSoqlQuery("Account", [], 1, 50);
    expect(soql).toContain("SELECT Id FROM Account");
  });

  it("caps pageSize at 200", () => {
    const soql = buildSoqlQuery("Contact", ["Id"], 1, 500);
    expect(soql).toContain("LIMIT 200");
  });

  it("throws when OFFSET would exceed 2000", () => {
    // page=42, pageSize=50 → offset = 41*50 = 2050 > 2000
    expect(() => buildSoqlQuery("Contact", ["Id"], 42, 50)).toThrow("SALESFORCE_OFFSET_EXCEEDED");
  });
});

describe("buildCountQuery", () => {
  it("returns COUNT() query", () => {
    expect(buildCountQuery("Contact")).toBe("SELECT COUNT() FROM Contact");
  });
});

describe("executeQuery", () => {
  it("maps query result to PaginatedRecords", async () => {
    const conn = {
      query: vi.fn().mockResolvedValue({
        totalSize: 100,
        done: true,
        records: [{ attributes: { type: "Contact" }, Id: "001", Name: "John" }],
      }),
    };
    const result = await executeQuery(conn, "SELECT Id FROM Contact LIMIT 25 OFFSET 0", 1, 25);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).not.toHaveProperty("attributes");
    expect(result.totalCount).toBe(100);
    expect(result.currentPage).toBe(1);
    expect(result.hasNextPage).toBe(true);
  });

  it("uses totalCountHint when provided", async () => {
    const conn = {
      query: vi.fn().mockResolvedValue({ totalSize: 5, done: true, records: [] }),
    };
    const result = await executeQuery(conn, "SELECT Id FROM Opp LIMIT 25 OFFSET 0", 1, 25, 999);
    expect(result.totalCount).toBe(999);
  });

  it("hasNextPage is false when on last page", async () => {
    const conn = {
      query: vi.fn().mockResolvedValue({ totalSize: 10, done: true, records: new Array(10).fill({}) }),
    };
    const result = await executeQuery(conn, "SELECT Id FROM T LIMIT 25 OFFSET 0", 1, 25, 10);
    expect(result.hasNextPage).toBe(false);
  });
});
