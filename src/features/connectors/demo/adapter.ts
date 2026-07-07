// Adaptateurs de démonstration — schémas statiques, aucune connexion réseau.
// Deux adaptateurs distincts (source / destination) : chaque connexion sait
// ainsi quel schéma servir sans dépendre du plan.

import type { ConnectorAdapter, ConnectorFieldDef, ConnectorObjectDef } from "../contract";
import { DEMO_DESTINATION_OBJECTS, DEMO_SOURCE_OBJECTS, type DemoObject } from "./data";

function toObjectDefs(objects: DemoObject[]): ConnectorObjectDef[] {
  return objects.map((o) => ({
    apiName: o.apiName,
    label: o.label,
    description: o.description,
    isCustom: o.isCustom ?? false,
  }));
}

function toFieldDefs(objects: DemoObject[], objectApiName: string): ConnectorFieldDef[] {
  const object = objects.find((o) => o.apiName === objectApiName);
  if (!object) throw new Error(`Objet démo inconnu : ${objectApiName}`);
  return object.fields.map((f) => ({
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired ?? false,
    isReadOnly: false,
    isUnique: false,
    isAccessible: true,
    picklistValues: f.picklistValues,
  }));
}

export const demoSourceAdapter: ConnectorAdapter = {
  descriptor: {
    type: "demo-source",
    label: "CRM démo",
    description: "Schéma de démonstration (8 objets, style Salesforce) — aucun credential requis",
    sides: ["SOURCE"],
    connectMode: "direct",
  },
  capabilities: { canRead: true, canWrite: false, canWriteSchema: false },
  objectMetadata: {
    defaultSelectedObjects: ["Account", "Contact", "Opportunity", "Case"],
    systemExactNames: [],
    // Mêmes règles que Salesforce pour exercer la classification en démo.
    systemPrefixes: ["Apex", "Async", "Auth", "Flow", "Setup", "Permission", "Login"],
    systemSuffixes: ["Feed", "History", "Share", "ChangeEvent", "Tag"],
  },
  async getObjects() {
    return toObjectDefs(DEMO_SOURCE_OBJECTS);
  },
  async getFields(_connectionId: string, objectApiName: string) {
    return toFieldDefs(DEMO_SOURCE_OBJECTS, objectApiName);
  },
};

export const demoDestinationAdapter: ConnectorAdapter = {
  descriptor: {
    type: "demo-destination",
    label: "CRM démo",
    description: "Portail de démonstration (4 objets, style HubSpot) — aucun credential requis",
    sides: ["DESTINATION"],
    connectMode: "direct",
  },
  capabilities: { canRead: true, canWrite: false, canWriteSchema: false },
  objectMetadata: {
    defaultSelectedObjects: DEMO_DESTINATION_OBJECTS.map((o) => o.apiName),
    systemExactNames: [],
    systemPrefixes: [],
    systemSuffixes: [],
  },
  async getObjects() {
    return toObjectDefs(DEMO_DESTINATION_OBJECTS);
  },
  async getFields(_connectionId: string, objectApiName: string) {
    return toFieldDefs(DEMO_DESTINATION_OBJECTS, objectApiName);
  },
};
