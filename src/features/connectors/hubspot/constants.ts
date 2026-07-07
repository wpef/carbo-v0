// HubSpot — constantes (port v4).

export const HS_ENV_KEYS = {
  clientId: "HUBSPOT_CLIENT_ID",
  clientSecret: "HUBSPOT_CLIENT_SECRET",
  callbackUrl: "HUBSPOT_CALLBACK_URL",
} as const;

/**
 * Scopes OAuth2 demandés à l'initiation du flux.
 * Note (leçon v4) : `crm.schemas.custom.read/write` ne sont PAS des scopes
 * valides — les objets custom passent par `crm.objects.custom.*`
 * (portails Enterprise uniquement).
 */
export const HS_OAUTH_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write",
  "crm.objects.custom.read",
  "crm.objects.custom.write",
  "tickets",
].join(" ");

export const HS_API_BASE = "https://api.hubapi.com";
export const HS_AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
export const HS_TOKEN_URL = `${HS_API_BASE}/oauth/v1/token`;

/** Les objets intégrés que tout portail HubSpot expose. */
export const HS_STANDARD_OBJECTS: Array<{
  apiName: string;
  label: string;
  description: string;
}> = [
  { apiName: "contacts", label: "Contacts", description: "Personnes en relation avec l'entreprise" },
  { apiName: "companies", label: "Companies", description: "Entreprises et organisations" },
  { apiName: "deals", label: "Deals", description: "Opportunités commerciales" },
  { apiName: "tickets", label: "Tickets", description: "Tickets de support" },
  { apiName: "line_items", label: "Line Items", description: "Lignes produit des transactions" },
];
