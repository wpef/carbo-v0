// Salesforce — types internes de l'adaptateur (port v4).

/** Configuration de la Connected App (variables d'environnement). */
export type SalesforceConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  /** `https://login.salesforce.com` (prod) ou `https://test.salesforce.com` (sandbox). */
  loginUrl: string;
};

/** Corps de réponse de /services/oauth2/token. */
export type SalesforceTokenResponse = {
  access_token: string;
  refresh_token?: string;
  signature: string;
  scope?: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
};

export type PkceChallenge = { verifier: string; challenge: string };

/** Ce qui est persisté dans ConnectorConnection.config (JSON) après OAuth. */
export type SalesforceConnectionConfig = {
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  /** ISO 8601 — l'access_token SF expire ~30 min après issued_at. */
  tokenExpiresAt: string;
  orgName?: string;
  userId?: string;
};
