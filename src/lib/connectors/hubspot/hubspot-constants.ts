// HubSpot adapter — standard objects, creatable types, env var keys
// Ref: specs/adapters/hubspot/ (T006)

/** Env var keys used by the HubSpot adapter. */
export const HS_ENV_KEYS = {
  clientId: 'HUBSPOT_CLIENT_ID',
  clientSecret: 'HUBSPOT_CLIENT_SECRET',
  callbackUrl: 'HUBSPOT_CALLBACK_URL',
} as const

/** HubSpot OAuth2 scopes requested when initiating the flow. */
export const HS_OAUTH_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.schemas.contacts.read',
  'crm.schemas.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.schemas.companies.read',
  'crm.schemas.companies.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.schemas.deals.read',
  'crm.schemas.deals.write',
  'crm.objects.custom.read',
  'crm.objects.custom.write',
  'crm.schemas.custom.read',
  'crm.schemas.custom.write',
  'tickets',
].join(' ')

/** HubSpot API base URL for manual REST calls (when the SDK doesn't cover a path). */
export const HS_API_BASE = 'https://api.hubapi.com'

/** OAuth authorization URL (browser redirect target). */
export const HS_AUTHORIZE_URL = 'https://app.hubspot.com/oauth/authorize'

/** OAuth token endpoint (server-to-server POST). */
export const HS_TOKEN_URL = `${HS_API_BASE}/oauth/v1/token`

/** The five built-in object types that every HubSpot portal exposes. */
export const STANDARD_OBJECTS: Array<{
  apiName: string
  label: string
  description: string
}> = [
  { apiName: 'contacts', label: 'Contact', description: 'People associated with your company' },
  { apiName: 'companies', label: 'Company', description: 'Organizations you are working with' },
  { apiName: 'deals', label: 'Deal', description: 'Sales opportunities' },
  { apiName: 'tickets', label: 'Ticket', description: 'Support tickets' },
  { apiName: 'line_items', label: 'Line Item', description: 'Product line items on deals' },
]

/** Types that can be created via the Properties API from Carbo-v0. */
export const CREATABLE_PROPERTY_TYPES = [
  'string',
  'number',
  'date',
  'datetime',
  'enumeration',
  'bool',
] as const

/** Default property group name per standard object (fallback when input.groupName not set). */
export const DEFAULT_PROPERTY_GROUPS: Record<string, string> = {
  contacts: 'contactinformation',
  companies: 'companyinformation',
  deals: 'dealinformation',
  tickets: 'ticketinformation',
  line_items: 'lineiteminformation',
}

/** Map Carbo property type -> HubSpot fieldType (the widget on the HubSpot form). */
export const TYPE_TO_FIELD_TYPE: Record<string, string> = {
  string: 'text',
  number: 'number',
  date: 'date',
  datetime: 'date',
  enumeration: 'select',
  bool: 'booleancheckbox',
}
