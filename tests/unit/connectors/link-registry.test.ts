// Tests unitaires — registres de correspondances objets/champs (port v4 → v5).
// v4 : auto-link-registry.ts (objets) + auto-match-registry.ts (champs).
// v5 : link-registry.ts — computeAutoLinkPairs / computeFieldMatchPairs.
//
// Changements v4 → v5 pris en compte :
// - computeAutoMatchPairs → computeFieldMatchPairs ; les champs sont désormais
//   des objets { apiName, dataType } (les champs dataType 'id' sont exclus des
//   deux côtés) et les mappings existants passent en une seule liste de paires.
// - getAutoLinkPairs / getFieldAutoMatchPairs n'existent plus (le contenu du
//   registre est couvert via compute*).

import { describe, it, expect } from "vitest";
import {
  computeAutoLinkPairs,
  computeFieldMatchPairs,
} from "@/features/connectors/link-registry";

// Inventaires réalistes (Principe IV — pas de fixtures jouets).
const SF_OBJECTS = ["Account", "Contact", "Lead", "Opportunity", "Case", "Task", "Custom_Project__c"];
const HS_OBJECTS = ["companies", "contacts", "deals", "tickets", "line_items"];

const asFields = (names: string[]) => names.map((apiName) => ({ apiName, dataType: "string" }));

// Champs réalistes SF Contact / HS contacts (Principe IV).
const SF_CONTACT_FIELDS = asFields([
  "FirstName", "LastName", "Email", "Phone", "Title", "Department", "OwnerId",
]);
const HS_CONTACT_FIELDS = asFields([
  "firstname", "lastname", "email", "phone", "jobtitle", "department", "hs_object_id",
]);

// ─────────────────────────────────────────────────────────────────────────────
// computeAutoLinkPairs (objets — registre seul, spec 011)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeAutoLinkPairs (registry-only, spec 011)", () => {
  it("creates every predictable pair whose objects exist on both sides", () => {
    const result = computeAutoLinkPairs("salesforce", "hubspot", SF_OBJECTS, HS_OBJECTS);
    expect(result).toEqual([
      { sourceObjectName: "Account", destinationObjectName: "companies" },
      { sourceObjectName: "Contact", destinationObjectName: "contacts" },
      { sourceObjectName: "Opportunity", destinationObjectName: "deals" },
      { sourceObjectName: "Lead", destinationObjectName: "contacts" },
      { sourceObjectName: "Case", destinationObjectName: "tickets" },
    ]);
  });

  it('regression #1: Contact→contacts is created (naive case-folded equality would miss it: "contact" !== "contacts")', () => {
    const result = computeAutoLinkPairs("salesforce", "hubspot", ["Contact"], ["contacts"]);
    expect(result).toEqual([{ sourceObjectName: "Contact", destinationObjectName: "contacts" }]);
  });

  it("allows two distinct sources to target the same destination (Contact + Lead → contacts)", () => {
    const result = computeAutoLinkPairs("salesforce", "hubspot", ["Contact", "Lead"], ["contacts"]);
    expect(result).toEqual([
      { sourceObjectName: "Contact", destinationObjectName: "contacts" },
      { sourceObjectName: "Lead", destinationObjectName: "contacts" },
    ]);
  });

  it("skips a pair when the destination object is absent from the snapshot", () => {
    const result = computeAutoLinkPairs("salesforce", "hubspot", ["Account"], ["contacts", "deals"]);
    expect(result).toEqual([]);
  });

  it("is idempotent: already-mapped source objects are skipped", () => {
    const result = computeAutoLinkPairs("salesforce", "hubspot", SF_OBJECTS, HS_OBJECTS, [
      "Account",
      "Contact",
    ]);
    expect(result).toEqual([
      { sourceObjectName: "Opportunity", destinationObjectName: "deals" },
      { sourceObjectName: "Lead", destinationObjectName: "contacts" },
      { sourceObjectName: "Case", destinationObjectName: "tickets" },
    ]);
  });

  it("creates nothing for two systems with no predictable pairs (spec 011 edge case)", () => {
    expect(computeAutoLinkPairs("zoho", "pipedrive", SF_OBJECTS, HS_OBJECTS)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeFieldMatchPairs (champs — registre ∪ name-based, spec 012)
// ─────────────────────────────────────────────────────────────────────────────

describe("computeFieldMatchPairs (registry ∪ name-based, spec 012)", () => {
  it("matches both registry pairs (Title→jobtitle) and name-based pairs (Email→email, Department→department)", () => {
    const result = computeFieldMatchPairs(
      "salesforce", "hubspot", "Contact", "contacts",
      SF_CONTACT_FIELDS, HS_CONTACT_FIELDS,
    );
    // registry-only semantic rename
    expect(result).toContainEqual({ sourceFieldName: "Title", destinationFieldName: "jobtitle" });
    // case-insensitive name matches
    expect(result).toContainEqual({ sourceFieldName: "FirstName", destinationFieldName: "firstname" });
    expect(result).toContainEqual({ sourceFieldName: "Email", destinationFieldName: "email" });
    expect(result).toContainEqual({ sourceFieldName: "Phone", destinationFieldName: "phone" });
    // name-based union for a field NOT in the registry
    expect(result).toContainEqual({ sourceFieldName: "Department", destinationFieldName: "department" });
    // OwnerId has no destination equivalent → unmatched
    expect(result.find((p) => p.sourceFieldName === "OwnerId")).toBeUndefined();
  });

  it("matches case-insensitively (Phone → phone)", () => {
    const result = computeFieldMatchPairs(
      "salesforce", "hubspot", "Contact", "contacts",
      asFields(["Phone"]), asFields(["phone"]),
    );
    expect(result).toEqual([{ sourceFieldName: "Phone", destinationFieldName: "phone" }]);
  });

  it("does not double-map a destination already taken by a registry pair", () => {
    // Title→jobtitle (registry). A hypothetical source "Jobtitle" must NOT also grab "jobtitle".
    const result = computeFieldMatchPairs(
      "salesforce", "hubspot", "Contact", "contacts",
      asFields(["Title", "Jobtitle"]), asFields(["jobtitle"]),
    );
    expect(result).toEqual([{ sourceFieldName: "Title", destinationFieldName: "jobtitle" }]);
  });

  it("is idempotent: already-mapped source and destination fields are excluded", () => {
    const result = computeFieldMatchPairs(
      "salesforce", "hubspot", "Contact", "contacts",
      SF_CONTACT_FIELDS, HS_CONTACT_FIELDS,
      [{ sourceFieldName: "Email", destinationFieldName: "firstname" }],
    );
    expect(result.find((p) => p.sourceFieldName === "Email")).toBeUndefined();
    expect(result.find((p) => p.destinationFieldName === "firstname")).toBeUndefined();
    // unaffected pairs still present
    expect(result).toContainEqual({ sourceFieldName: "Title", destinationFieldName: "jobtitle" });
  });

  it("falls back to name matching when the registry target is absent from the destination snapshot", () => {
    // Case→tickets : Priority vise hs_ticket_priority (registre) absent du
    // snapshot → retombe sur le name-based 'priority' ; Status ne matche rien.
    const result = computeFieldMatchPairs(
      "salesforce", "hubspot", "Case", "tickets",
      asFields(["Subject", "Priority", "Status"]), asFields(["subject", "priority", "content"]),
    );
    expect(result).toEqual([
      { sourceFieldName: "Subject", destinationFieldName: "subject" },
      { sourceFieldName: "Priority", destinationFieldName: "priority" },
    ]);
  });
});
