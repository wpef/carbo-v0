// Tests unitaires — computeFieldStats (pur, côté client, aucun mock) — port v4 → v5.
// Changement v4 → v5 : import @/lib/utils/compute-field-stats → @/features/schema/lib/compute-field-stats.
// Sémantique des assertions inchangée (règles validées en recette).
// Principe IV : formes de champs CRM réalistes.

import { describe, it, expect } from "vitest";
import { computeFieldStats } from "@/features/schema/lib/compute-field-stats";

// ---------------------------------------------------------------------------
// Fixtures — enregistrements Salesforce Contact réalistes
// ---------------------------------------------------------------------------

const SF_CONTACTS = [
  { Id: "CON-0001", FirstName: "Alice", LastName: "Smith", Email: "alice.smith@example.com", Phone: null, AccountId: "ACC-0001", Industry: "Technology" },
  { Id: "CON-0002", FirstName: "Bob",   LastName: "Jones", Email: "bob.jones@example.com",  Phone: "+1-555-1002", AccountId: "ACC-0002", Industry: "Finance" },
  { Id: "CON-0003", FirstName: "Bob",   LastName: "Davis", Email: "bob.davis@example.com",  Phone: "+1-555-1003", AccountId: "ACC-0001", Industry: "Technology" },
  { Id: "CON-0004", FirstName: "Diana", LastName: "Brown", Email: null,                     Phone: null,          AccountId: "ACC-0003", Industry: null },
];

describe("computeFieldStats", () => {
  it("returns empty array for empty input", () => {
    expect(computeFieldStats([])).toEqual([]);
  });

  it("computes nullCount correctly for Phone (2 nulls out of 4)", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const phoneStat = stats.find((s) => s.fieldApiName === "Phone");
    expect(phoneStat).toBeDefined();
    expect(phoneStat!.nullCount).toBe(2);
  });

  it("computes nullCount=0 for LastName (all present)", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const lastNameStat = stats.find((s) => s.fieldApiName === "LastName");
    expect(lastNameStat!.nullCount).toBe(0);
  });

  it("computes distinctCount correctly for FirstName (Alice, Bob, Diana = 3 distinct)", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const firstNameStat = stats.find((s) => s.fieldApiName === "FirstName");
    expect(firstNameStat!.distinctCount).toBe(3);
  });

  it("returns up to 5 unique sample values for Industry", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const industryStat = stats.find((s) => s.fieldApiName === "Industry");
    // Technology, Finance sont non-null ; Industry=null est exclu des samples.
    expect(industryStat!.sampleValues.length).toBeLessThanOrEqual(5);
    expect(industryStat!.sampleValues).toContain("Technology");
    expect(industryStat!.sampleValues).toContain("Finance");
  });

  it("null field value does not appear in sampleValues", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const emailStat = stats.find((s) => s.fieldApiName === "Email");
    // Email est null pour CON-0004 — ne doit pas apparaître dans les samples.
    expect(emailStat!.sampleValues).not.toContain(null);
  });

  it("marks binary fields with nullCount=-1 and distinctCount=-1", () => {
    const recordsWithBinary = [
      { Id: "CON-0001", Photo: "[binary data]", Name: "Alice" },
      { Id: "CON-0002", Photo: null,            Name: "Bob" },
    ];
    const stats = computeFieldStats(recordsWithBinary);
    const photoStat = stats.find((s) => s.fieldApiName === "Photo");
    expect(photoStat!.nullCount).toBe(-1);
    expect(photoStat!.distinctCount).toBe(-1);
    expect(photoStat!.sampleValues).toHaveLength(0);
  });

  it("handles sparse records (fields absent from some records count as null)", () => {
    const sparse = [
      { Id: "CON-0001", Name: "Alice", Extra: "x" },
      { Id: "CON-0002", Name: "Bob" }, // Extra absent
    ];
    const stats = computeFieldStats(sparse);
    const extraStat = stats.find((s) => s.fieldApiName === "Extra");
    expect(extraStat).toBeDefined();
    expect(extraStat!.nullCount).toBe(1); // absent = null
  });

  it("collects stats for all fields across all records (union of keys)", () => {
    const stats = computeFieldStats(SF_CONTACTS);
    const fieldNames = stats.map((s) => s.fieldApiName);
    expect(fieldNames).toContain("Id");
    expect(fieldNames).toContain("FirstName");
    expect(fieldNames).toContain("LastName");
    expect(fieldNames).toContain("Email");
    expect(fieldNames).toContain("Phone");
    expect(fieldNames).toContain("AccountId");
    expect(fieldNames).toContain("Industry");
  });

  it("single-record input: nullCount=0 for present fields, sampleValues=[value]", () => {
    const stats = computeFieldStats([{ Name: "Acme Corp", Industry: "Technology", Revenue: null }]);
    const nameStat = stats.find((s) => s.fieldApiName === "Name")!;
    expect(nameStat.nullCount).toBe(0);
    expect(nameStat.distinctCount).toBe(1);
    expect(nameStat.sampleValues).toEqual(["Acme Corp"]);

    const revStat = stats.find((s) => s.fieldApiName === "Revenue")!;
    expect(revStat.nullCount).toBe(1);
    expect(revStat.distinctCount).toBe(0);
    expect(revStat.sampleValues).toEqual([]);
  });

  it("does not duplicate values in sampleValues even if they repeat in records", () => {
    const records = [
      { Stage: "Prospecting" },
      { Stage: "Prospecting" },
      { Stage: "Qualification" },
    ];
    const stats = computeFieldStats(records);
    const stageStat = stats.find((s) => s.fieldApiName === "Stage")!;
    // 'Prospecting' ne doit apparaître qu'une seule fois dans sampleValues.
    const prospectingCount = stageStat.sampleValues.filter((v) => v === "Prospecting").length;
    expect(prospectingCount).toBe(1);
  });

  it("caps sampleValues at 5 entries", () => {
    const records = Array.from({ length: 20 }, (_, i) => ({ Color: `color-${i}` }));
    const stats = computeFieldStats(records);
    const colorStat = stats.find((s) => s.fieldApiName === "Color")!;
    expect(colorStat.sampleValues.length).toBeLessThanOrEqual(5);
  });
});
