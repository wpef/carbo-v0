// Salesforce adapter — system object filtering and default selection rules
// Ref: specs/adapters/salesforce/ (T006)

/** Env var keys used by the Salesforce adapter. */
export const SF_ENV_KEYS = {
  clientId: 'SALESFORCE_CLIENT_ID',
  clientSecret: 'SALESFORCE_CLIENT_SECRET',
  callbackUrl: 'SALESFORCE_CALLBACK_URL',
  loginUrl: 'SALESFORCE_LOGIN_URL',
} as const

/** Default login URL if `SALESFORCE_LOGIN_URL` is not set. */
export const SF_DEFAULT_LOGIN_URL = 'https://login.salesforce.com'

/** Salesforce REST API version used throughout the adapter. */
export const SF_API_VERSION = '59.0'

/** OAuth scope string. `full` grants API access; `refresh_token` enables offline refresh. */
export const SF_OAUTH_SCOPE = 'full refresh_token'

/**
 * Patterns that identify Salesforce system objects we hide by default.
 * Based on research: prefixes/suffixes/exact names that are internal metadata,
 * not business data, and not typically migrated.
 */
export const SYSTEM_OBJECT_PATTERNS = {
  /** Exact object names (case-sensitive) that are always considered system. */
  exact: new Set<string>([
    'OrgWideEmailAddress', 'PermissionSet', 'PermissionSetAssignment', 'PermissionSetGroup',
    'Profile', 'User', 'UserLogin', 'UserRole', 'Group', 'GroupMember',
    'LoginHistory', 'LoginGeo', 'LoginIp',
    'RecordType', 'BusinessProcess', 'FieldPermissions', 'ObjectPermissions',
    'AssignmentRule', 'AutoResponseRule', 'EscalationRule', 'MatchingRule',
    'CronJobDetail', 'CronTrigger', 'AsyncApexJob', 'ApexClass', 'ApexTrigger', 'ApexPage',
    'StaticResource', 'Document', 'Domain', 'Site',
    'NetworkMember', 'Network', 'AuthSession', 'SessionPermSetActivation',
    'Organization', 'Holiday', 'BusinessHours',
  ]),
  /** Prefixes identifying system objects. */
  prefixes: ['Apex', 'Auth', 'Content', 'Entity', 'Flow', 'Login', 'Setup', 'Scratch', 'Feed'] as const,
  /** Suffixes (typically history, share, change event tables). */
  suffixes: ['History', 'Share', 'ChangeEvent', 'Feed', '__Tag', '__History', '__Share', '__Feed'] as const,
}

/** Common CRM objects pre-selected by default when the consultant arrives on object selection. */
export const DEFAULT_CRM_OBJECTS = new Set<string>([
  'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign',
  'Task', 'Event', 'Note', 'Attachment', 'ContentDocument', 'CampaignMember',
])

/**
 * Decide whether an object is a system object (hidden by default).
 * @returns `true` if the object should be filtered out of the default view.
 */
export function isSystemObject(apiName: string): boolean {
  if (SYSTEM_OBJECT_PATTERNS.exact.has(apiName)) return true
  for (const prefix of SYSTEM_OBJECT_PATTERNS.prefixes) {
    if (apiName.startsWith(prefix)) return true
  }
  for (const suffix of SYSTEM_OBJECT_PATTERNS.suffixes) {
    if (apiName.endsWith(suffix)) return true
  }
  // Double-underscore prefix (managed package or system namespaces like `__`).
  if (apiName.startsWith('__')) return true
  return false
}

/**
 * Decide whether an object should be pre-selected by default.
 * Per spec: custom objects (suffix `__c`) + common CRM objects (Account, Contact, Lead, …).
 */
export function isDefaultSelected(apiName: string, isCustom: boolean): boolean {
  if (isCustom && apiName.endsWith('__c')) return true
  if (DEFAULT_CRM_OBJECTS.has(apiName)) return true
  return false
}
