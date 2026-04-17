// Adapter registry — lists available connectors and their config fields

export interface AdapterConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
}

/**
 * How the adapter authenticates:
 * - `form`    — user fills credentials in a form, posted to /api/plans/[planId]/{source|destination}
 * - `oauth2`  — user clicks a button that redirects to the provider's auth page; callback persists the connection
 * - `mixed`   — both form (e.g. Private App token) and OAuth2 are offered (HubSpot)
 */
export type AuthKind = 'form' | 'oauth2' | 'mixed'

export interface AdapterMetadata {
  type: string
  label: string
  role: 'source' | 'destination'
  authKind: AuthKind
  configFields: AdapterConfigField[]
  commonBusinessObjects?: string[]
  systemObjectPrefixes?: string[]
}

const ADAPTERS: AdapterMetadata[] = [
  {
    type: 'salesforce',
    label: 'Salesforce',
    role: 'source',
    authKind: 'oauth2',
    // OAuth2+PKCE: credentials are obtained via the browser flow, not the form.
    configFields: [],
    commonBusinessObjects: ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign'],
    // Extended list of well-known system object name prefixes/exact-names filtered by default.
    systemObjectPrefixes: ['__', 'Apex', 'Auth', 'Content', 'Data', 'Entity', 'Flow', 'Login', 'Setup'],
  },
  {
    type: 'demo',
    label: 'Demo Data',
    role: 'source',
    authKind: 'form',
    configFields: [],
    commonBusinessObjects: ['Contact', 'Account', 'Deal'],
    systemObjectPrefixes: [],
  },
  {
    type: 'hubspot',
    label: 'HubSpot',
    role: 'destination',
    authKind: 'mixed',
    // Only the Private App form field is exposed; OAuth2 flow uses its own dedicated button.
    configFields: [
      { name: 'accessToken', label: 'Private App Token', type: 'password', required: true },
    ],
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
  },
  {
    type: 'demo-destination',
    label: 'Demo Destination',
    role: 'destination',
    authKind: 'form',
    configFields: [],
    commonBusinessObjects: ['contacts', 'companies', 'deals', 'tickets'],
    systemObjectPrefixes: [],
  },
]

export function getAvailableAdapters(role: 'source' | 'destination'): AdapterMetadata[] {
  return ADAPTERS.filter((a) => a.role === role)
}

export function getAdapterMetadata(type: string): AdapterMetadata | undefined {
  return ADAPTERS.find((a) => a.type === type)
}
