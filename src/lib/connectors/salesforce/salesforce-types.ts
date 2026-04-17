// Salesforce adapter — internal types
// Ref: specs/adapters/salesforce/ (T002)

/** OAuth2 Connected App configuration from env vars. */
export interface SalesforceConfig {
  clientId: string
  clientSecret: string
  callbackUrl: string
  /** `https://login.salesforce.com` (prod) or `https://test.salesforce.com` (sandbox). */
  loginUrl: string
}

/** Response body of the Salesforce /services/oauth2/token endpoint. */
export interface SalesforceTokenResponse {
  access_token: string
  refresh_token?: string
  signature: string
  scope?: string
  id_token?: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
}

/** PKCE challenge pair generated per auth flow. */
export interface PkceChallenge {
  verifier: string
  challenge: string
}

/** Config persisted in SourceConnection.config after a successful OAuth flow. */
export interface SalesforceConnectionConfig {
  instanceUrl: string
  accessToken: string
  refreshToken?: string
  /** ISO 8601 string; the access_token expires ~30 min after issued_at. */
  tokenExpiresAt: string
  /** Human-readable org name (from identity endpoint). */
  orgName?: string
  /** Internal SF user ID (from the identity URL). */
  userId?: string
}
