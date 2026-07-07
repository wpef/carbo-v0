// Tests unitaires — lecture du schéma HubSpot (port v4 → v5).
// fetch est mocké — aucun appel réseau réel.
//
// Changements v4 → v5 pris en compte :
// - plus de isSelected sur les objets : la pré-sélection est transposée vers
//   isSelectedByDefault (src/features/schema/classification) pilotée par les
//   métadonnées HubSpot (objets standard pré-sélectionnés, custom toujours).
// - messages d'erreur passés en français.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStandardObjects,
  getCustomObjects,
  getProperties,
  normaliseType,
} from "@/features/connectors/hubspot/schema";
import { HS_STANDARD_OBJECTS } from "@/features/connectors/hubspot/constants";
import { isSelectedByDefault } from "@/features/schema/classification";
import type { AdapterObjectMetadata } from "@/features/connectors/contract";

const MOCK_TOKEN = "test-token";

// Métadonnées HubSpot reconstruites (identiques à hubspotAdapter.objectMetadata).
const HS_METADATA: AdapterObjectMetadata = {
  defaultSelectedObjects: HS_STANDARD_OBJECTS.map((o) => o.apiName),
  systemExactNames: [],
  systemPrefixes: [],
  systemSuffixes: [],
};

describe("getStandardObjects", () => {
  it("returns the five built-in objects", () => {
    const objects = getStandardObjects();
    expect(objects).toHaveLength(5);
    const apiNames = objects.map((o) => o.apiName);
    expect(apiNames).toContain("contacts");
    expect(apiNames).toContain("companies");
    expect(apiNames).toContain("deals");
    expect(apiNames).toContain("tickets");
    expect(apiNames).toContain("line_items");
  });

  it("marks all standard objects as isCustom=false", () => {
    const objects = getStandardObjects();
    expect(objects.every((o) => o.isCustom === false)).toBe(true);
  });

  it("pre-selects all standard objects (transposé vers isSelectedByDefault)", () => {
    const objects = getStandardObjects();
    expect(
      objects.every((o) => isSelectedByDefault(HS_METADATA, o.apiName, o.isCustom) === true),
    ).toBe(true);
  });
});

describe("getCustomObjects", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty array on 403 (non-Enterprise portal)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: "Forbidden" });
    const result = await getCustomObjects(MOCK_TOKEN);
    expect(result).toEqual([]);
  });

  it("returns empty array on 404", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" });
    const result = await getCustomObjects(MOCK_TOKEN);
    expect(result).toEqual([]);
  });

  it("maps custom object results to ConnectorObjectDef", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: "my_custom_object",
            labels: { singular: "My Object", plural: "My Objects" },
            objectTypeId: "0-99",
            archived: false,
          },
        ],
      }),
    });

    const result = await getCustomObjects(MOCK_TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].apiName).toBe("my_custom_object");
    expect(result[0].label).toBe("My Objects");
    expect(result[0].isCustom).toBe(true);
    // Transposé de isSelected=true (v4) : un objet custom est pré-sélectionné.
    expect(isSelectedByDefault(HS_METADATA, result[0].apiName, result[0].isCustom)).toBe(true);
  });

  it("excludes archived custom objects", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: "active_object",
            labels: { singular: "Active", plural: "Actives" },
            objectTypeId: "0-1",
            archived: false,
          },
          {
            name: "archived_object",
            labels: { singular: "Archived", plural: "Archiveds" },
            objectTypeId: "0-2",
            archived: true,
          },
        ],
      }),
    });

    const result = await getCustomObjects(MOCK_TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].apiName).toBe("active_object");
  });

  it("throws on non-403/404 errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" });
    await expect(getCustomObjects(MOCK_TOKEN)).rejects.toThrow("API Schemas HubSpot en échec");
  });
});

describe("getProperties", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps HubSpot properties to ConnectorFieldDef", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: "firstname",
            label: "First Name",
            type: "string",
            modificationMetadata: { readOnlyValue: false },
            hasUniqueValue: false,
          },
          {
            name: "email",
            label: "Email",
            type: "string",
            modificationMetadata: { readOnlyValue: false },
            hasUniqueValue: true,
          },
          {
            name: "hs_object_id",
            label: "Record ID",
            type: "number",
            modificationMetadata: { readOnlyValue: true },
            hasUniqueValue: true,
          },
        ],
      }),
    });

    const fields = await getProperties(MOCK_TOKEN, "contacts");
    expect(fields).toHaveLength(3);

    const email = fields.find((f) => f.apiName === "email");
    expect(email?.isUnique).toBe(true);
    expect(email?.dataType).toBe("string");

    const id = fields.find((f) => f.apiName === "hs_object_id");
    expect(id?.isReadOnly).toBe(true);
    expect(id?.dataType).toBe("decimal"); // number -> decimal
  });

  it("maps enumeration type with picklistValues", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: "hs_lead_status",
            label: "Lead Status",
            type: "enumeration",
            options: [
              { label: "New", value: "NEW" },
              { label: "Open", value: "OPEN" },
              { label: "In Progress", value: "IN_PROGRESS" },
            ],
          },
        ],
      }),
    });

    const fields = await getProperties(MOCK_TOKEN, "contacts");
    const status = fields[0];
    expect(status.dataType).toBe("picklist"); // enumeration -> picklist
    expect(status.picklistValues).toEqual(["NEW", "OPEN", "IN_PROGRESS"]);
  });

  it("throws on API error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" });
    await expect(getProperties(MOCK_TOKEN, "unknown_object")).rejects.toThrow(
      "Lecture des propriétés HubSpot échouée",
    );
  });
});

describe("normaliseType (hubspot)", () => {
  it.each([
    ["string", "string"],
    ["number", "decimal"],
    ["date", "date"],
    ["datetime", "datetime"],
    ["enumeration", "picklist"],
    ["bool", "boolean"],
    ["phone_number", "phone"],
    ["calculation_equation", "calculation_equation"], // pass-through
  ])("maps %s -> %s", (hsType, expected) => {
    expect(normaliseType(hsType)).toBe(expected);
  });
});
