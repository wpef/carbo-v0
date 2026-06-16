import type { ConnectorAdapter } from '@/lib/types/connector'
import { demoAdapter } from './demo/demo-adapter'
import { salesforceAdapter } from './salesforce'
import { hubspotAdapter } from './hubspot'

const adapters = new Map<string, ConnectorAdapter>([
  ['demo', demoAdapter],
  ['salesforce', salesforceAdapter],
  ['hubspot', hubspotAdapter],
])

export function getAdapter(type: string): ConnectorAdapter {
  const adapter = adapters.get(type)
  if (!adapter) throw new Error(`Unknown adapter type: ${type}`)
  return adapter
}

export function listAdapterTypes(): string[] {
  return [...adapters.keys()]
}
