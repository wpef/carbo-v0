// Registre des connecteurs — le SEUL endroit qui connaît la liste des
// adaptateurs. Ajouter un CRM = 1 import + 1 entrée ici.

import type { AdapterDescriptor, ConnectorAdapter } from "./contract";
import { demoDestinationAdapter, demoSourceAdapter } from "./demo/adapter";
import { salesforceAdapter } from "./salesforce/adapter";
import { hubspotAdapter } from "./hubspot/adapter";

const ADAPTERS: ConnectorAdapter[] = [
  salesforceAdapter,
  hubspotAdapter,
  demoSourceAdapter,
  demoDestinationAdapter,
];

const BY_TYPE = new Map(ADAPTERS.map((a) => [a.descriptor.type, a]));

export function getAdapter(type: string): ConnectorAdapter {
  const adapter = BY_TYPE.get(type);
  if (!adapter) throw new Error(`Adaptateur inconnu : ${type}`);
  return adapter;
}

/** Descripteurs des connecteurs branchables sur un côté donné (pour le picker UI). */
export function listAdaptersForSide(side: "SOURCE" | "DESTINATION"): AdapterDescriptor[] {
  return ADAPTERS.filter((a) => a.descriptor.sides.includes(side)).map((a) => a.descriptor);
}
