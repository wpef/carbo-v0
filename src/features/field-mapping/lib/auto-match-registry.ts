// 012-field-mapping — Auto-match registry for predictable cross-system field pairs.
// Spec 012 US3 + §Assumptions: canonical behaviour is the UNION of (a) registry pairs and
// (b) a case-insensitive name-based fallback for fields not covered by the registry.

export interface FieldPair {
  sourceFieldApiName: string
  destFieldApiName: string
}

export interface ResolvedFieldPair {
  sourceFieldName: string
  destinationFieldName: string
}

// Keyed by `${sourceAdapter}:${destAdapter}:${sourceObjectApiName}:${destObjectApiName}`.
const FIELD_AUTO_MATCH_MAP: Record<string, FieldPair[]> = {
  'salesforce:hubspot:Contact:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'MobilePhone', destFieldApiName: 'mobilephone' },
    { sourceFieldApiName: 'Title', destFieldApiName: 'jobtitle' },
  ],
  'salesforce:hubspot:Account:companies': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'name' },
    { sourceFieldApiName: 'Website', destFieldApiName: 'domain' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'BillingCity', destFieldApiName: 'city' },
    { sourceFieldApiName: 'BillingCountry', destFieldApiName: 'country' },
    { sourceFieldApiName: 'NumberOfEmployees', destFieldApiName: 'numberofemployees' },
    { sourceFieldApiName: 'Industry', destFieldApiName: 'industry' },
  ],
  'salesforce:hubspot:Lead:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
    { sourceFieldApiName: 'Title', destFieldApiName: 'jobtitle' },
    { sourceFieldApiName: 'Company', destFieldApiName: 'company' },
  ],
  'salesforce:hubspot:Opportunity:deals': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'dealname' },
    { sourceFieldApiName: 'Amount', destFieldApiName: 'amount' },
    { sourceFieldApiName: 'CloseDate', destFieldApiName: 'closedate' },
    { sourceFieldApiName: 'StageName', destFieldApiName: 'dealstage' },
  ],
  'demo:demo-destination:Contact:contacts': [
    { sourceFieldApiName: 'FirstName', destFieldApiName: 'firstname' },
    { sourceFieldApiName: 'LastName', destFieldApiName: 'lastname' },
    { sourceFieldApiName: 'Email', destFieldApiName: 'email' },
    { sourceFieldApiName: 'Phone', destFieldApiName: 'phone' },
  ],
  'demo:demo-destination:Account:companies': [
    { sourceFieldApiName: 'Name', destFieldApiName: 'name' },
    { sourceFieldApiName: 'Website', destFieldApiName: 'domain' },
  ],
}

/**
 * Predictable auto-match field pairs for a given adapter/object combination.
 * Empty array when none are defined.
 */
export function getFieldAutoMatchPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectApiName: string,
  destObjectApiName: string,
): FieldPair[] {
  const key = `${sourceAdapterType}:${destAdapterType}:${sourceObjectApiName}:${destObjectApiName}`
  return FIELD_AUTO_MATCH_MAP[key] ?? []
}

/**
 * Pure resolution of which field mappings auto-match should create, as the UNION of:
 *  1. registry pairs (semantic equivalences, e.g. Title -> jobtitle), and
 *  2. a case-insensitive name-based fallback (e.g. Email -> email, Phone -> phone)
 *     for source fields not already covered by the registry.
 *
 * Dedup is two-sided (one source per dest and one dest per source), matching the
 * `@@unique([objectMappingId, sourceFieldName])` and `[..., destinationFieldName]`
 * constraints. `alreadyMapped*` lets callers exclude existing mappings (idempotency).
 */
export function computeAutoMatchPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectApiName: string,
  destObjectApiName: string,
  sourceFieldApiNames: string[],
  destFieldApiNames: string[],
  alreadyMappedSource: string[] = [],
  alreadyMappedDest: string[] = [],
): ResolvedFieldPair[] {
  const destByLower = new Map(destFieldApiNames.map((n) => [n.toLowerCase(), n]))
  const usedSource = new Set(alreadyMappedSource)
  const usedDestLower = new Set(alreadyMappedDest.map((n) => n.toLowerCase()))
  const sourceSet = new Set(sourceFieldApiNames)
  const out: ResolvedFieldPair[] = []

  const tryAdd = (sourceName: string, destName: string): void => {
    const destLower = destName.toLowerCase()
    if (usedSource.has(sourceName) || usedDestLower.has(destLower)) return
    out.push({ sourceFieldName: sourceName, destinationFieldName: destName })
    usedSource.add(sourceName)
    usedDestLower.add(destLower)
  }

  // 1. Registry pairs (case-insensitive destination resolution — v3 recette lesson).
  for (const pair of getFieldAutoMatchPairs(sourceAdapterType, destAdapterType, sourceObjectApiName, destObjectApiName)) {
    if (!sourceSet.has(pair.sourceFieldApiName)) continue
    const destActual = destByLower.get(pair.destFieldApiName.toLowerCase())
    if (destActual) tryAdd(pair.sourceFieldApiName, destActual)
  }

  // 2. Name-based fallback (case-insensitive), union with the registry.
  for (const sourceName of sourceFieldApiNames) {
    if (usedSource.has(sourceName)) continue
    const destActual = destByLower.get(sourceName.toLowerCase())
    if (destActual) tryAdd(sourceName, destActual)
  }

  return out
}
