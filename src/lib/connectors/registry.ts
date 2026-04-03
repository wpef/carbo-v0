// Adapter registry — lists available connectors and their config fields

export interface AdapterConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
}

export interface AdapterMetadata {
  type: string
  label: string
  role: 'source' | 'destination'
  configFields: AdapterConfigField[]
}

const ADAPTERS: AdapterMetadata[] = [
  {
    type: 'salesforce',
    label: 'Salesforce',
    role: 'source',
    configFields: [
      { name: 'instanceUrl', label: 'Instance URL', type: 'url', required: true },
      { name: 'accessToken', label: 'Access Token', type: 'password', required: true },
    ],
  },
  {
    type: 'demo',
    label: 'Demo Data',
    role: 'source',
    configFields: [],
  },
  {
    type: 'hubspot',
    label: 'HubSpot',
    role: 'destination',
    configFields: [
      { name: 'accessToken', label: 'Access Token', type: 'password', required: true },
    ],
  },
  {
    type: 'demo-destination',
    label: 'Demo Destination',
    role: 'destination',
    configFields: [],
  },
]

export function getAvailableAdapters(role: 'source' | 'destination'): AdapterMetadata[] {
  return ADAPTERS.filter((a) => a.role === role)
}

export function getAdapterMetadata(type: string): AdapterMetadata | undefined {
  return ADAPTERS.find((a) => a.type === type)
}
