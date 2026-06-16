// Adapter metadata: common business objects and system object prefixes per adapter type.
// Used by object-selection to bootstrap defaults and filter system objects.

export interface AdapterMetadata {
  commonBusinessObjects: string[]
  systemObjectPrefixes: string[]
}

const METADATA: Record<string, AdapterMetadata> = {
  salesforce: {
    commonBusinessObjects: ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign'],
    systemObjectPrefixes: ['__', 'Apex', 'Auth', 'Content', 'Data', 'Entity', 'Flow', 'Login', 'Setup'],
  },
  demo: {
    commonBusinessObjects: ['Contact', 'Account', 'Deal'],
    systemObjectPrefixes: [],
  },
  hubspot: {
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
  },
  'demo-destination': {
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
  },
}

export function getAdapterMetadata(adapterType: string): AdapterMetadata {
  return METADATA[adapterType] ?? { commonBusinessObjects: [], systemObjectPrefixes: [] }
}
