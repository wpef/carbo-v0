// HubSpot — types internes de l'adaptateur (port v4).

/** Configuration de l'app OAuth2 (variables d'environnement). */
export type HubSpotOAuthConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

/** Corps de réponse de /oauth/v1/token. */
export type HubSpotTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // secondes
  token_type: "bearer";
};

/** Réponse de /account-info/v3/details (validation de token). */
export type HubSpotPortalInfo = {
  portalId: number;
  accountType?: string;
  timeZone?: string;
  companyCurrency?: string;
  portalName?: string;
};

/**
 * Ce qui est persisté dans ConnectorConnection.config (JSON).
 * Deux méthodes d'auth : OAuth2 (tokens à refresh) ou Private App
 * (token statique fourni par l'utilisateur — pas d'expiration à gérer).
 */
export type HubSpotConnectionConfig =
  | {
      authMethod: "oauth2";
      accessToken: string;
      refreshToken: string;
      /** ISO 8601 — l'access_token OAuth vaut ~30 min. */
      tokenExpiresAt: string;
      portalId: number;
      portalName?: string;
    }
  | {
      authMethod: "private-app";
      accessToken: string;
      portalId: number;
      portalName?: string;
    };
