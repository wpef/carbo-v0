// 009-record-preview — Shared adapter factory (extracted from schema-retrieval)

import { DemoSourceAdapter } from '@/lib/connectors/adapters/demo-source'
import { DemoDestinationAdapter } from '@/lib/connectors/adapters/demo-destination'
import { SalesforceAdapter } from '@/lib/connectors/salesforce'
import { HubSpotAdapter } from '@/lib/connectors/hubspot'
import type { ConnectorAdapter } from '@/lib/connectors/types'

export class UnknownAdapterError extends Error {
  constructor(adapterType: string) {
    super(`Unknown adapter: ${adapterType}`)
    this.name = 'UnknownAdapterError'
  }
}

export function getAdapterInstance(adapterType: string): ConnectorAdapter {
  switch (adapterType) {
    case 'demo':
      return new DemoSourceAdapter()
    case 'demo-destination':
      return new DemoDestinationAdapter()
    case 'salesforce':
      return new SalesforceAdapter()
    case 'hubspot':
      return new HubSpotAdapter()
    default:
      throw new UnknownAdapterError(adapterType)
  }
}
