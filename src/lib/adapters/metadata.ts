// Adapter metadata: common business objects and system object prefixes/suffixes per adapter type.
// Used by object-selection to bootstrap defaults and classify/filter system objects.

import { DEFAULT_CRM_OBJECTS } from '@/lib/adapters/salesforce/salesforce-constants'

export interface AdapterMetadata {
  commonBusinessObjects: string[]
  systemObjectPrefixes: string[]
  systemObjectSuffixes: string[]
}

const METADATA: Record<string, AdapterMetadata> = {
  salesforce: {
    // Single source of truth for the SF default-selection set — shared with isDefaultSelected()
    // so the schema layer and the selection layer can never diverge again.
    commonBusinessObjects: [...DEFAULT_CRM_OBJECTS],
    systemObjectPrefixes: ['__', 'Apex', 'Auth', 'Content', 'Data', 'Entity', 'Flow', 'Login', 'Setup'],
    // A real SF org exposes ~1000+ internal objects via these suffixes (AccountFeed, AccountHistory,
    // AccountShare, AccountChangeEvent, AccountTag …). Prefix-only filtering left them all visible.
    systemObjectSuffixes: ['Feed', 'History', 'Share', 'ChangeEvent', 'Tag'],
  },
  demo: {
    commonBusinessObjects: ['Contact', 'Account', 'Deal'],
    systemObjectPrefixes: [],
    systemObjectSuffixes: [],
  },
  hubspot: {
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
    systemObjectSuffixes: [],
  },
  'demo-destination': {
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
    systemObjectSuffixes: [],
  },
}

export function getAdapterMetadata(adapterType: string): AdapterMetadata {
  return (
    METADATA[adapterType] ?? { commonBusinessObjects: [], systemObjectPrefixes: [], systemObjectSuffixes: [] }
  )
}
