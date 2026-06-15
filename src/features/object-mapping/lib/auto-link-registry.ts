// 011-object-mapping — Auto-link registry for predictable cross-system object pairs.
// Spec 011 US2: auto-link creates links ONLY for predictable pairs (registry-driven).
// Edge case (spec 011 §Edge Cases): no predictable pairs => no links created.

export interface AutoLinkPair {
  sourceApiName: string
  destApiName: string
}

export interface ResolvedObjectPair {
  sourceObjectName: string
  destinationObjectName: string
}

// Static map keyed by `${sourceAdapterType}:${destAdapterType}`.
// Maintained at the application level, extensible per connector combination (spec 011 §Assumptions).
const AUTO_LINK_MAP: Record<string, AutoLinkPair[]> = {
  'salesforce:hubspot': [
    { sourceApiName: 'Account', destApiName: 'companies' },
    { sourceApiName: 'Contact', destApiName: 'contacts' },
    { sourceApiName: 'Opportunity', destApiName: 'deals' },
    { sourceApiName: 'Lead', destApiName: 'contacts' },
  ],
  'demo:demo-destination': [
    { sourceApiName: 'Contact', destApiName: 'contacts' },
    { sourceApiName: 'Account', destApiName: 'companies' },
    { sourceApiName: 'Deal', destApiName: 'deals' },
  ],
}

/**
 * Predictable auto-link pairs for a given source/destination adapter combination.
 * Empty array when no pairs are defined for the combination.
 */
export function getAutoLinkPairs(sourceAdapterType: string, destAdapterType: string): AutoLinkPair[] {
  return AUTO_LINK_MAP[`${sourceAdapterType}:${destAdapterType}`] ?? []
}

/**
 * Pure resolution of which object mappings auto-link should create.
 *
 * Registry-only (spec 011): a pair is created when BOTH its source and destination
 * objects exist in the current snapshots and the source object is not already mapped.
 * Multiple sources may legitimately target the same destination (e.g. Contact + Lead
 * -> contacts); dedup is by source object only, matching the
 * `@@unique([planId, sourceObjectName, destinationObjectName])` constraint.
 */
export function computeAutoLinkPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectApiNames: string[],
  destObjectApiNames: string[],
  alreadyMappedSourceNames: string[] = [],
): ResolvedObjectPair[] {
  const sourceSet = new Set(sourceObjectApiNames)
  const destSet = new Set(destObjectApiNames)
  const used = new Set(alreadyMappedSourceNames)
  const out: ResolvedObjectPair[] = []

  for (const pair of getAutoLinkPairs(sourceAdapterType, destAdapterType)) {
    if (used.has(pair.sourceApiName)) continue
    if (!sourceSet.has(pair.sourceApiName) || !destSet.has(pair.destApiName)) continue
    out.push({ sourceObjectName: pair.sourceApiName, destinationObjectName: pair.destApiName })
    used.add(pair.sourceApiName)
  }

  return out
}
