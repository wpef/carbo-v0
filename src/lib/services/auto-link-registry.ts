// 011-object-mapping — Auto-link registry for predictable cross-system object pairs

import type { AutoLinkPair } from '@/lib/types/mapping'

// Static map keyed by `${sourceAdapterType}:${destinationAdapterType}`
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
 * Returns predictable auto-link pairs for a given source/destination adapter combination.
 * Returns an empty array if no pairs are defined for the combination.
 */
export function getAutoLinkPairs(sourceAdapterType: string, destAdapterType: string): AutoLinkPair[] {
  const key = `${sourceAdapterType}:${destAdapterType}`
  return AUTO_LINK_MAP[key] ?? []
}
