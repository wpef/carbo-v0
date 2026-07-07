// Tests unitaires — mapping du schéma Salesforce + classification (port v4 → v5).
// jsforce / db / audit sont mockés — aucun réseau, aucune base.
//
// Changements v4 → v5 pris en compte :
// - mapDescribeGlobalToSchema({sobjects}) → mapDescribeGlobalToObjects(sobjects)
// - plus de isSelected ni de description '[system]' dans le mapping : ces règles
//   sont transposées vers classifyObject / isSelectedByDefault (src/features/schema).
// - plus de relationshipType sur les champs reference (assertion supprimée).

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks hoistés (jsforce + db + audit) pour les tests de l'adaptateur ---

const { mockDescribeGlobal, mockDescribe, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockDescribeGlobal: vi.fn(),
  mockDescribe: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("jsforce", () => {
  class MockConnection {
    describeGlobal = mockDescribeGlobal;
    describe = mockDescribe;
  }
  return { default: { Connection: MockConnection } };
});

vi.mock("@/lib/db", () => ({
  db: {
    connectorConnection: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  mapDescribeGlobalToObjects,
  mapDescribeToFields,
  normaliseType,
} from "@/features/connectors/salesforce/schema";
import {
  SF_DEFAULT_CRM_OBJECTS,
  SF_SYSTEM_EXACT_NAMES,
  SF_SYSTEM_PREFIXES,
  SF_SYSTEM_SUFFIXES,
} from "@/features/connectors/salesforce/constants";
import { classifyObject, isSelectedByDefault } from "@/features/schema/classification";
import { salesforceAdapter } from "@/features/connectors/salesforce/adapter";
import type { AdapterObjectMetadata } from "@/features/connectors/contract";

// Métadonnées SF reconstruites depuis les constantes (identiques à salesforceAdapter.objectMetadata).
const SF_METADATA: AdapterObjectMetadata = {
  defaultSelectedObjects: SF_DEFAULT_CRM_OBJECTS,
  systemExactNames: SF_SYSTEM_EXACT_NAMES,
  systemPrefixes: SF_SYSTEM_PREFIXES,
  systemSuffixes: SF_SYSTEM_SUFFIXES,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. mapDescribeGlobalToObjects
// ─────────────────────────────────────────────────────────────────────────────

describe("mapDescribeGlobalToObjects", () => {
  it("maps standard sobjects to ConnectorObjectDef[]", () => {
    const result = mapDescribeGlobalToObjects([
      { name: "Contact", label: "Contact", custom: false, queryable: true },
      { name: "Account", label: "Account", custom: false, queryable: true },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].apiName).toBe("Contact");
    expect(result[0].isCustom).toBe(false);
  });

  it("filters out non-queryable objects", () => {
    const result = mapDescribeGlobalToObjects([
      { name: "Contact", label: "Contact", custom: false, queryable: true },
      { name: "InternalThing", label: "Internal", custom: false, queryable: false },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].apiName).toBe("Contact");
  });

  it("filters out deprecated objects", () => {
    const result = mapDescribeGlobalToObjects([
      { name: "Contact", label: "Contact", custom: false, queryable: true, deprecatedAndHidden: true },
      { name: "Account", label: "Account", custom: false, queryable: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].apiName).toBe("Account");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. mapDescribeToFields
// ─────────────────────────────────────────────────────────────────────────────

describe("mapDescribeToFields", () => {
  const baseField = {
    name: "FirstName",
    label: "First Name",
    type: "string",
    nillable: true,
    createable: true,
    updateable: true,
    unique: false,
  };

  it("maps basic string field", () => {
    const fields = mapDescribeToFields({ name: "Contact", label: "Contact", fields: [baseField] });
    expect(fields[0].apiName).toBe("FirstName");
    expect(fields[0].dataType).toBe("string");
    expect(fields[0].isRequired).toBe(false);
    expect(fields[0].isReadOnly).toBe(false);
  });

  it("marks non-nillable createable field as required", () => {
    const fields = mapDescribeToFields({
      name: "Contact",
      label: "Contact",
      fields: [{ ...baseField, name: "LastName", nillable: false, createable: true }],
    });
    expect(fields[0].isRequired).toBe(true);
  });

  it("marks non-createable non-updateable field as readOnly", () => {
    const fields = mapDescribeToFields({
      name: "Contact",
      label: "Contact",
      fields: [{ ...baseField, name: "Id", createable: false, updateable: false }],
    });
    expect(fields[0].isReadOnly).toBe(true);
  });

  it("maps reference field with referenceTo", () => {
    const fields = mapDescribeToFields({
      name: "Contact",
      label: "Contact",
      fields: [
        {
          name: "AccountId",
          label: "Account ID",
          type: "reference",
          nillable: true,
          createable: true,
          updateable: true,
          unique: false,
          referenceTo: ["Account"],
        },
      ],
    });
    expect(fields[0].dataType).toBe("reference");
    expect(fields[0].referenceTo).toBe("Account");
  });

  it("maps picklist field with active values only", () => {
    const fields = mapDescribeToFields({
      name: "Lead",
      label: "Lead",
      fields: [
        {
          name: "Status",
          label: "Status",
          type: "picklist",
          nillable: true,
          createable: true,
          updateable: true,
          unique: false,
          picklistValues: [
            { value: "Open", active: true },
            { value: "Closed", active: false },
            { value: "Converted", active: true },
          ],
        },
      ],
    });
    expect(fields[0].dataType).toBe("picklist");
    expect(fields[0].picklistValues).toEqual(["Open", "Converted"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. normaliseType
// ─────────────────────────────────────────────────────────────────────────────

describe("normaliseType (salesforce)", () => {
  it.each([
    ["string", "string"],
    ["textarea", "string"],
    ["phone", "phone"],
    ["email", "email"],
    ["url", "url"],
    ["int", "integer"],
    ["integer", "integer"],
    ["double", "decimal"],
    ["long", "decimal"],
    ["currency", "currency"],
    ["percent", "percent"],
    ["boolean", "boolean"],
    ["date", "date"],
    ["datetime", "datetime"],
    ["time", "time"],
    ["picklist", "picklist"],
    ["multipicklist", "picklist"],
    ["reference", "reference"],
    ["id", "string"],
    ["encryptedstring", "encryptedstring"], // exotique — pass-through
  ])("maps %s → %s", (input, expected) => {
    expect(normaliseType(input)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Classification (ex-isSystemObject / isDefaultSelected de v4, transposés
//    vers classifyObject / isSelectedByDefault pilotés par les métadonnées SF)
// ─────────────────────────────────────────────────────────────────────────────

describe("classification des objets Salesforce", () => {
  describe("classifyObject (ex-isSystemObject)", () => {
    it.each([
      "ApexClass",
      "AuthSession",
      "LoginHistory",
      "Profile",
      "User",
      "ContactHistory",
      "ContactShare",
      "ContactChangeEvent",
      "FlowElement",
      "SetupAuditTrail",
    ])("identifies %s as system object", (name) => {
      expect(classifyObject(SF_METADATA, name, false)).toBe("system");
    });

    it.each(["Contact", "Account", "Lead", "Invoice__c", "CustomObject__c"])(
      "does not flag %s as system object",
      (name) => {
        expect(classifyObject(SF_METADATA, name, name.endsWith("__c"))).not.toBe("system");
      },
    );

    it("classifies system objects as 'system' (ex-description '[system]' du mapping v4)", () => {
      expect(classifyObject(SF_METADATA, "ApexClass", false)).toBe("system");
    });
  });

  describe("isSelectedByDefault (ex-isDefaultSelected)", () => {
    it("pre-selects common CRM objects", () => {
      expect(isSelectedByDefault(SF_METADATA, "Contact", false)).toBe(true);
      expect(isSelectedByDefault(SF_METADATA, "Account", false)).toBe(true);
      expect(isSelectedByDefault(SF_METADATA, "Lead", false)).toBe(true);
    });

    it("pre-selects custom objects with __c suffix", () => {
      expect(isSelectedByDefault(SF_METADATA, "Invoice__c", true)).toBe(true);
    });

    it("does not pre-select non-CRM standard objects", () => {
      expect(isSelectedByDefault(SF_METADATA, "Pricebook2", false)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. salesforceAdapter (contrat ConnectorAdapter — jsforce/db/audit mockés)
// ─────────────────────────────────────────────────────────────────────────────

describe("salesforceAdapter", () => {
  const VALID_SF_CONN_CONFIG = {
    instanceUrl: "https://na1.salesforce.com",
    accessToken: "ACCESS_TOKEN",
    refreshToken: "REFRESH_TOKEN",
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h from now
    orgName: "ACME Org",
    userId: "USER_001",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "conn-1",
      adapterType: "salesforce",
      config: JSON.stringify(VALID_SF_CONN_CONFIG),
    });
  });

  it("capabilities are read-only", () => {
    expect(salesforceAdapter.capabilities.canRead).toBe(true);
    expect(salesforceAdapter.capabilities.canWrite).toBe(false);
    expect(salesforceAdapter.capabilities.canWriteSchema).toBe(false);
  });

  describe("getObjects()", () => {
    it("calls describeGlobal and maps to ConnectorObjectDef[]", async () => {
      mockDescribeGlobal.mockResolvedValue({
        sobjects: [
          { name: "Contact", label: "Contact", custom: false, queryable: true },
          { name: "Invoice__c", label: "Invoice", custom: true, queryable: true },
        ],
      });
      const objects = await salesforceAdapter.getObjects("conn-1");
      expect(objects).toHaveLength(2);
      expect(objects[0].apiName).toBe("Contact");
      expect(objects[1].isCustom).toBe(true); // __c custom object
    });
  });

  describe("getFields()", () => {
    it("calls describe(objectApiName) and returns ConnectorFieldDef[]", async () => {
      mockDescribe.mockResolvedValue({
        name: "Contact",
        label: "Contact",
        fields: [
          { name: "Id", label: "Contact ID", type: "id", nillable: false, createable: false, updateable: false, unique: true },
          { name: "FirstName", label: "First Name", type: "string", nillable: true, createable: true, updateable: true, unique: false },
        ],
      });
      const fields = await salesforceAdapter.getFields("conn-1", "Contact");
      expect(fields).toHaveLength(2);
      expect(fields[0].apiName).toBe("Id");
      expect(fields[0].isReadOnly).toBe(true);
      expect(fields[1].dataType).toBe("string");
    });
  });
});
