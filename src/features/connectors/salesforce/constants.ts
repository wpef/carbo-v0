// Salesforce — constantes (port v4, validé en recette réelle sur org 1123 objets).

export const SF_ENV_KEYS = {
  clientId: "SALESFORCE_CLIENT_ID",
  clientSecret: "SALESFORCE_CLIENT_SECRET",
  callbackUrl: "SALESFORCE_CALLBACK_URL",
  loginUrl: "SALESFORCE_LOGIN_URL",
} as const;

export const SF_DEFAULT_LOGIN_URL = "https://login.salesforce.com";
export const SF_API_VERSION = "59.0";
/** `full` donne l'accès API ; `refresh_token` permet le refresh hors-session. */
export const SF_OAUTH_SCOPE = "full refresh_token";

/**
 * Classification des objets système SF (leçon de recette f246f8ab : les
 * SUFFIXES comptent autant que les préfixes — 0 → 488 objets masquables).
 */
export const SF_SYSTEM_EXACT_NAMES = [
  "OrgWideEmailAddress", "PermissionSet", "PermissionSetAssignment", "PermissionSetGroup",
  "Profile", "User", "UserLogin", "UserRole", "Group", "GroupMember",
  "LoginHistory", "LoginGeo", "LoginIp",
  "RecordType", "BusinessProcess", "FieldPermissions", "ObjectPermissions",
  "AssignmentRule", "AutoResponseRule", "EscalationRule", "MatchingRule",
  "CronJobDetail", "CronTrigger", "AsyncApexJob", "ApexClass", "ApexTrigger", "ApexPage",
  "StaticResource", "Document", "Domain", "Site",
  "NetworkMember", "Network", "AuthSession", "SessionPermSetActivation",
  "Organization", "Holiday", "BusinessHours",
];

export const SF_SYSTEM_PREFIXES = [
  "Apex", "Auth", "Content", "Entity", "Flow", "Login", "Setup", "Scratch", "Feed", "__",
];

export const SF_SYSTEM_SUFFIXES = [
  "History", "Share", "ChangeEvent", "Feed", "__Tag", "__History", "__Share", "__Feed",
];

/** Objets CRM courants pré-sélectionnés par défaut (source unique de vérité). */
export const SF_DEFAULT_CRM_OBJECTS = [
  "Account", "Contact", "Lead", "Opportunity", "Case", "Campaign",
  "Task", "Event", "Note", "Attachment", "ContentDocument", "CampaignMember",
];
