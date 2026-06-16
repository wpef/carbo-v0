// @vitest-environment node
//
// Integration test — record preview service against Neon DB + demo adapter.
// Proves fetchRecordPage resolves the connection, calls the adapter, and emits audit.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  fetchRecordPage,
  fetchRecordCount,
  expandObject,
  RecordPreviewPlanNotFoundError,
  RecordPreviewConnectionNotFoundError,
} from '@/features/schema/services/record-preview-service'

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

async function seedPlanWithDemo() {
  const conn = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: 'Demo (record-preview-test)', status: 'CONNECTED' },
  })
  connectionIds.push(conn.id)

  const plan = await prisma.migrationPlan.create({
    data: { name: 'Record Preview Test', sourceConnectionId: conn.id },
  })
  planIds.push(plan.id)

  return { plan, conn }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchRecordPage — integration (demo adapter)', () => {
  it('returns paginated records from the demo adapter (Contact, page 1, size 25)', async () => {
    const { plan } = await seedPlanWithDemo()

    const result = await fetchRecordPage(plan.id, 'SOURCE', 'Contact', 1, 25)

    expect(result.records.length).toBe(25)
    expect(result.currentPage).toBe(1)
    expect(result.pageSize).toBe(25)
    expect(result.totalCount).toBe(50) // demo has 50 contacts
    expect(result.hasNextPage).toBe(true)
  })

  it('returns page 2 with correct offset', async () => {
    const { plan } = await seedPlanWithDemo()

    const result = await fetchRecordPage(plan.id, 'SOURCE', 'Contact', 2, 25)
    expect(result.records.length).toBe(25)
    expect(result.hasNextPage).toBe(false) // 50 contacts / 25 = exactly 2 pages

    // IDs on page 2 should be CON-0026..CON-0050
    const firstId = (result.records[0] as Record<string, unknown>).Id as string
    expect(firstId).toMatch(/^CON-002/)
  })

  it('sanitises null values correctly (preserves null as-is, no placeholder)', async () => {
    const { plan } = await seedPlanWithDemo()
    const result = await fetchRecordPage(plan.id, 'SOURCE', 'Contact', 1, 25)
    // Demo Contact record has Phone=null for some rows (i % 3 === 0)
    const nullPhoneRow = result.records.find((r) => (r as Record<string, unknown>).Phone === null)
    expect(nullPhoneRow).toBeDefined()
  })

  it('emits RECORDS_PREVIEWED audit log', async () => {
    const { plan } = await seedPlanWithDemo()
    const before = await prisma.auditLog.count({ where: { planId: plan.id } })

    await fetchRecordPage(plan.id, 'SOURCE', 'Contact', 1, 50)

    const after = await prisma.auditLog.count({ where: { planId: plan.id } })
    expect(after).toBeGreaterThan(before)

    const log = await prisma.auditLog.findFirst({
      where: { planId: plan.id, action: 'RECORDS_PREVIEWED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(JSON.parse(log!.details)).toMatchObject({ objectApiName: 'Contact', side: 'SOURCE' })
  })

  it('throws RecordPreviewPlanNotFoundError for unknown planId', async () => {
    await expect(fetchRecordPage('non-existent-plan-id', 'SOURCE', 'Contact', 1, 50)).rejects.toBeInstanceOf(
      RecordPreviewPlanNotFoundError,
    )
  })

  it('throws RecordPreviewConnectionNotFoundError when plan has no source connection', async () => {
    const plan = await prisma.migrationPlan.create({ data: { name: 'No connection plan' } })
    planIds.push(plan.id)

    await expect(fetchRecordPage(plan.id, 'SOURCE', 'Contact', 1, 50)).rejects.toBeInstanceOf(
      RecordPreviewConnectionNotFoundError,
    )
  })
})

describe('fetchRecordCount — integration (demo adapter)', () => {
  it('returns correct record count for Account (50)', async () => {
    const { plan } = await seedPlanWithDemo()
    const count = await fetchRecordCount(plan.id, 'SOURCE', 'Account')
    expect(count).toBe(50)
  })
})

describe('expandObject — integration (demo adapter)', () => {
  it('returns recordCount, fields, and up to 5 sample records', async () => {
    const { plan } = await seedPlanWithDemo()
    const result = await expandObject(plan.id, 'SOURCE', 'Deal')

    expect(result.objectApiName).toBe('Deal')
    expect(result.recordCount).toBe(50)
    expect(result.fields.length).toBeGreaterThan(0)
    expect(result.sampleRecords.length).toBeGreaterThanOrEqual(3)
    expect(result.sampleRecords.length).toBeLessThanOrEqual(5)
  })

  it('sample records contain expected Deal fields', async () => {
    const { plan } = await seedPlanWithDemo()
    const result = await expandObject(plan.id, 'SOURCE', 'Deal')
    const first = result.sampleRecords[0] as Record<string, unknown>
    expect(first.Id).toBeDefined()
    expect(first.Name).toBeDefined()
    expect(first.Stage).toBeDefined()
  })
})
