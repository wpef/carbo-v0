// HubSpot adapter — internal types
// Ref: specs/adapters/hubspot/ (T002)

/** OAuth2 App configuration (from env vars). */
export interface HubSpotOAuthConfig {
  clientId: string
  clientSecret: string
  callbackUrl: string
}

/** Private App token (provided by the user via the form). */
export interface HubSpotPrivateAppConfig {
  accessToken: string
}

/** Discriminated union of the two supported auth methods. */
export type HubSpotConfig =
  | { authMethod: 'oauth2'; oauth: HubSpotOAuthConfig }
  | { authMethod: 'private-app'; privateApp: HubSpotPrivateAppConfig }

/** Response body of HubSpot's /oauth/v1/token endpoint. */
export interface HubSpotTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds
  token_type: 'bearer'
}

/** Response of the /account-info/v3/details endpoint (after token validation). */
export interface HubSpotPortalInfo {
  portalId: number
  accountType?: string
  timeZone?: string
  companyCurrency?: string
  portalName?: string
}

/** Config persisted in DestinationConnection.config after a successful connect. */
export type HubSpotConnectionConfig =
  | {
      authMethod: 'oauth2'
      accessToken: string
      refreshToken: string
      /** ISO 8601 string (OAuth2 access_token typically valid 30 min). */
      tokenExpiresAt: string
      portalId: number
      portalName?: string
    }
  | {
      authMethod: 'private-app'
      accessToken: string
      portalId: number
      portalName?: string
    }

/** Property types creatable from Carbo-v0 (subset of what HubSpot supports). */
export type CreatablePropertyType =
  | 'string'
  | 'number'
  | 'date'
  | 'datetime'
  | 'enumeration'
  | 'bool'

/** Input for creating a new HubSpot property via the Properties API. */
export interface PropertyCreateInput {
  name: string
  label: string
  type: CreatablePropertyType
  /** HubSpot field type — required; typically `text`, `number`, `date`, `select`, `booleancheckbox`. */
  fieldType: string
  description?: string
  groupName?: string
  /** Required for `enumeration` type. */
  options?: Array<{ label: string; value: string; displayOrder?: number }>
}

/** Input for creating a new custom object via the Schemas API. */
export interface ObjectCreateInput {
  name: string
  labels: { singular: string; plural: string }
  primaryDisplayProperty: string
  properties: PropertyCreateInput[]
  requiredProperties?: string[]
  searchableProperties?: string[]
}
