// @vitest-environment node
//
// Integration test (layer 2) — runs against the disposable Neon test branch
// (DATABASE_URL loaded from .env.test by vitest.setup.ts). Proves that the
// auto-link SERVICE persists the registry-resolved mappings end-to-end.
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { autoLinkObjects } from '@/features/object-mapping/services/object-mapping-service'

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  // Cascade order: plans (→ mappings, audit) first, then connections (→ snapshots, objects).
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

async function seedPlan() {
  const source = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: 'SF (test)', status: 'CONNECTED' },
  })
  const dest = await prisma.connectorConnection.create({
    data: { adapterType: 'hubspot', name: 'HS (test)', status: 'CONNECTED' },
  })
  connectionIds.push(source.id, dest.id)

  const plan = await prisma.migrationPlan.create({
    data: { name: 'Auto-link integration', sourceConnectionId: source.id, destinationConnectionId: dest.id },
  })
  planIds.push(plan.id)

  await prisma.schemaSnapshot.create({
    data: {
      connectionId: source.id, side: 'SOURCE', status: 'CURRENT',
      objects: { create: [
        { apiName: 'Account', label: 'Account' },
        { apiName: 'Contact', label: 'Contact' },
        { apiName: 'Lead', label: 'Lead' },
        { apiName: 'Opportunity', label: 'Opportunity' },
        { apiName: 'Case', label: 'Case' },
      ] },
    },
  })
  await prisma.schemaSnapshot.create({
    data: {
      connectionId: dest.id, side: 'DESTINATION', status: 'CURRENT',
      objects: { create: [
        { apiName: 'companies', label: 'Companies' },
        { apiName: 'contacts', label: 'Contacts' },
        { apiName: 'deals', label: 'Deals' },
      ] },
    },
  })

  return plan
}

describe('autoLinkObjects — integration against Neon (Salesforce → HubSpot)', () => {
  it('persists the registry-resolved predictable pairs with autoCreated=true', async () => {
    const plan = await seedPlan()

    const result = await autoLinkObjects(plan.id)
    // Account→companies, Contact→contacts, Opportunity→deals, Lead→contacts (Case has no HS counterpart)
    expect(result.created).toBe(4)

    const mappings = await prisma.objectMapping.findMany({
      where: { planId: plan.id },
      orderBy: [{ sourceObjectName: 'asc' }],
    })
    expect(mappings.map((m) => `${m.sourceObjectName}→${m.destinationObjectName}`)).toEqual([
      'Account→companies',
      'Contact→contacts',
      'Lead→contacts',
      'Opportunity→deals',
    ])
    expect(mappings.every((m) => m.autoCreated)).toBe(true)
  })

  it('is idempotent: a second run does not re-fire (objectAutoLinkedAt gate, Principle IX)', async () => {
    const plan = await seedPlan()
    await autoLinkObjects(plan.id)
    const second = await autoLinkObjects(plan.id)
    expect(second.created).toBe(0)
  })
})
