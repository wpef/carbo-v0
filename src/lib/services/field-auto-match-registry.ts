// 012-field-mapping — Auto-match registry for predictable cross-system field pairs

interface FieldPair {
  sourceFieldApiName: string
  destFieldApiName: string
}

// Static map keyed by `${sourceAdapterType}:${destAdapterType}:${sourceObjectApiName}:${destObjectApiName}`
// Falls back to wildcard `*:*:${sourceObjectApiName}:${destObjectApiName}` then `*:*:*:*`
const FIELD_AUTO_MATCH_MAP: Record<string, FieldPair[]> = {
  // Salesforce → HubSpot: Contact → contacts
  'salesforce:hubspot:Contact:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'MobilePhone', destFieldApiName: 'mobilephone' },
    { sourceFieldApiName: 'Title', destFieldApiName: 'jobtitle' },
  ],

  // Salesforce → HubSpot: Account → companies
  'salesforce:hubspot:Account:companies': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'name' },
    { sourceFieldApiName: 'Website', destFieldApiName: 'domain' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'BillingCity', destFieldApiName: 'city' },
    { sourceFieldApiName: 'BillingCountry', destFieldApiName: 'country' },
    { sourceFieldApiName: 'NumberOfEmployees', destFieldApiName: 'numberofemployees' },
    { sourceFieldApiName: 'Industry', destFieldApiName: 'industry' },
  ],

  // Salesforce → HubSpot: Lead → contacts
  'salesforce:hubspot:Lead:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'Title', destFieldApiName: 'jobtitle' },
    { sourceFieldApiName: 'Company', destFieldApiName: 'company' },
  ],

  // Salesforce → HubSpot: Opportunity → deals
  'salesforce:hubspot:Opportunity:deals': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'dealname' },
    { sourceFieldApiName: 'Amount', destFieldApiName: 'amount' },
    { sourceFieldApiName: 'CloseDate', destFieldApiName: 'closedate' },
    { sourceFieldApiName: 'StageName', destFieldApiName: 'dealstage' },
  ],

  // Demo adapter: Contact → contacts
  'demo:demo-destination:Contact:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
  ],

  // Demo adapter: Account → companies
  'demo:demo-destination:Account:companies': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'name' },
    { sourceFieldApiName: 'Website', destFieldApiName: 'domain' },
  ],
}

/**
 * Returns predictable auto-match field pairs for a given adapter/object combination.
 * Falls back to an empty array if no pairs are defined.
 */
export function getFieldAutoMatchPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectApiName: string,
  destObjectApiName: string,
): FieldPair[] {
  const specificKey = `${sourceAdapterType}:${destAdapterType}:${sourceObjectApiName}:${destObjectApiName}`
  if (FIELD_AUTO_MATCH_MAP[specificKey]) return FIELD_AUTO_MATCH_MAP[specificKey]

  const wildcardAdapterKey = `*:*:${sourceObjectApiName}:${destObjectApiName}`
  if (FIELD_AUTO_MATCH_MAP[wildcardAdapterKey]) return FIELD_AUTO_MATCH_MAP[wildcardAdapterKey]

  return []
}
