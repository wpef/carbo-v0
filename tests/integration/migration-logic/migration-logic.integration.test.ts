// @vitest-environment node
//
// Integration tests — 013-migration-logic (v4)
// Runs against the disposable Neon test branch (DATABASE_URL from .env.test).
// NOT launched by the unit-test runner — executed sequentially by the orchestrator.
//
// Covers:
//   - getMigrationLogic: returns null when no logic exists
//   - saveMigrationLogic D1: upserts, stores sectionType in config, replaces ValueEquivalence rows
//   - saveMigrationLogic D2: upserts ClassificationPrompt, stores sectionType in config
//   - saveMigrationLogic D4: no child rows, sectionType INFORMATIONAL
//   - Status transitions: DEFINED → VALIDATED
//   - deleteMigrationLogic: cascades to children
//   - buildMigrationLogicContext: resolves field metadata + picklistValues + sectionType

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  getMigrationLogic,
  saveMigrationLogic,
  deleteMigrationLogic,
  buildMigrationLogicContext,
} from '@/features/migration-logic/services/migration-logic-service'
import { getSectionType } from '@/features/field-mapping/lib/type-compatibility'
import { seedSnapshot } from '../_helpers/seed-schema'

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const planIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedPlanWithFieldMapping({
  srcType,
  dstType,
  srcPicklist,
  dstPicklist,
}: {
  srcType: string
  dstType: string
  srcPicklist?: string[]
  dstPicklist?: string[]
}) {
  // Connections
  const srcConn = await prisma.connectorConnection.create({
    data: { name: `src-${Date.now()}`, adapterType: 'SALESFORCE', status: 'CONNECTED' },
  })
  const dstConn = await prisma.connectorConnection.create({
    data: { name: `dst-${Date.now()}`, adapterType: 'HUBSPOT', status: 'CONNECTED' },
  })

  const plan = await prisma.migrationPlan.create({
    data: {
      name: `Test plan ${Date.now()}`,
      sourceConnectionId: srcConn.id,
      destinationConnectionId: dstConn.id,
      status: 'DRAFT',
    },
  })
  planIds.push(plan.id)

  // Seed snapshots
  await seedSnapshot(srcConn.id, 'SOURCE', [
    {
      apiName: 'Lead',
      label: 'Lead',
      fields: [
        {
          apiName: 'srcField',
          label: 'Source Field',
          dataType: srcType,
          picklistValues: srcPicklist ? JSON.stringify(srcPicklist) : null,
        },
      ],
    },
  ])
  await seedSnapshot(dstConn.id, 'DESTINATION', [
    {
      apiName: 'contact',
      label: 'Contact',
      fields: [
        {
          apiName: 'dstField',
          label: 'Destination Field',
          dataType: dstType,
          picklistValues: dstPicklist ? JSON.stringify(dstPicklist) : null,
        },
      ],
    },
  ])

  // Object mapping
  const objectMapping = await prisma.objectMapping.create({
    data: {
      planId: plan.id,
      sourceObjectName: 'Lead',
      destinationObjectName: 'contact',
    },
  })

  // Field mapping
  const fieldMapping = await prisma.fieldMapping.create({
    data: {
      objectMappingId: objectMapping.id,
      sourceFieldName: 'srcField',
      destinationFieldName: 'dstField',
      sourceFieldType: srcType,
      destinationFieldType: dstType,
      compatibilityStatus: 'COMPATIBLE',
    },
  })

  return { plan, objectMapping, fieldMapping }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getMigrationLogic', () => {
  it('returns null when no logic exists', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({ srcType: 'picklist', dstType: 'picklist' })
    const result = await getMigrationLogic(fieldMapping.id)
    expect(result).toBeNull()
  })
})

describe('saveMigrationLogic — D1 (VALUE_EQUIVALENCE)', () => {
  it('creates logic with sectionType in config + ValueEquivalence rows', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'picklist',
      dstType: 'picklist',
      srcPicklist: ['Hot', 'Cold', 'Warm'],
      dstPicklist: ['Chaud', 'Froid', 'Tiède'],
    })

    const saved = await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'VALUE_EQUIVALENCE',
      status: 'DEFINED',
      valueEquivalences: [
        { sourceValue: 'Hot', destinationValue: 'Chaud' },
        { sourceValue: 'Cold', destinationValue: 'Froid' },
      ],
    })

    expect(saved.sectionType).toBe('VALUE_EQUIVALENCE')
    expect(saved.status).toBe('DEFINED')
    expect(saved.valueEquivalences).toHaveLength(2)
    expect(saved.valueEquivalences.map((v) => v.sourceValue).sort()).toEqual(['Cold', 'Hot'])
    expect(saved.classificationPrompt).toBeNull()
  })

  it('replaces ValueEquivalence rows on upsert', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'picklist',
      dstType: 'picklist',
    })

    await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'VALUE_EQUIVALENCE',
      status: 'DEFINED',
      valueEquivalences: [{ sourceValue: 'A', destinationValue: 'X' }],
    })

    const updated = await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'VALUE_EQUIVALENCE',
      status: 'VALIDATED',
      valueEquivalences: [
        { sourceValue: 'B', destinationValue: 'Y' },
        { sourceValue: 'C', destinationValue: 'Z' },
      ],
    })

    expect(updated.status).toBe('VALIDATED')
    expect(updated.valueEquivalences).toHaveLength(2)
    // Old 'A→X' equivalence should be gone
    expect(updated.valueEquivalences.find((v) => v.sourceValue === 'A')).toBeUndefined()
  })
})

describe('saveMigrationLogic — D2 (PROMPT)', () => {
  it('creates logic with ClassificationPrompt', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'picklist',
      dstPicklist: ['Sales', 'Support', 'Other'],
    })

    const saved = await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'PROMPT',
      status: 'DEFINED',
      promptText: 'Classifie ce texte dans une des catégories suivantes',
    })

    expect(saved.sectionType).toBe('PROMPT')
    expect(saved.status).toBe('DEFINED')
    expect(saved.classificationPrompt?.promptText).toBe('Classifie ce texte dans une des catégories suivantes')
    expect(saved.valueEquivalences).toHaveLength(0)
  })

  it('updates prompt text on upsert', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'picklist',
    })

    await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'PROMPT',
      status: 'DEFINED',
      promptText: 'Version 1',
    })

    const updated = await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'PROMPT',
      status: 'VALIDATED',
      promptText: 'Version 2 enrichie',
    })

    expect(updated.classificationPrompt?.promptText).toBe('Version 2 enrichie')
    expect(updated.status).toBe('VALIDATED')
  })
})

describe('saveMigrationLogic — D4 (INFORMATIONAL)', () => {
  it('creates logic with no child rows', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'text',
    })

    const saved = await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'INFORMATIONAL',
      status: 'VALIDATED',
    })

    expect(saved.sectionType).toBe('INFORMATIONAL')
    expect(saved.status).toBe('VALIDATED')
    expect(saved.valueEquivalences).toHaveLength(0)
    expect(saved.classificationPrompt).toBeNull()
  })
})

describe('deleteMigrationLogic', () => {
  it('deletes logic and cascades to children', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'picklist',
      dstType: 'picklist',
    })

    await saveMigrationLogic(plan.id, fieldMapping.id, {
      sectionType: 'VALUE_EQUIVALENCE',
      status: 'DEFINED',
      valueEquivalences: [{ sourceValue: 'A', destinationValue: 'B' }],
    })

    await deleteMigrationLogic(plan.id, fieldMapping.id)

    const result = await getMigrationLogic(fieldMapping.id)
    expect(result).toBeNull()

    // Child rows should also be gone
    const logic = await prisma.migrationLogic.findUnique({ where: { fieldMappingId: fieldMapping.id } })
    expect(logic).toBeNull()
  })

  it('is idempotent when logic does not exist', async () => {
    const { plan, fieldMapping } = await seedPlanWithFieldMapping({ srcType: 'text', dstType: 'text' })
    // Should not throw
    await expect(deleteMigrationLogic(plan.id, fieldMapping.id)).resolves.toBeUndefined()
  })
})

describe('buildMigrationLogicContext', () => {
  it('resolves field metadata + sectionType + picklist values', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'picklist',
      dstType: 'picklist',
      srcPicklist: ['A', 'B', 'C'],
      dstPicklist: ['X', 'Y', 'Z'],
    })

    const ctx = await buildMigrationLogicContext(fieldMapping.id)
    expect(ctx).not.toBeNull()
    expect(ctx!.sectionType).toBe('VALUE_EQUIVALENCE')
    expect(ctx!.sourceField.type).toBe('picklist')
    expect(ctx!.destinationField.type).toBe('picklist')
    expect(ctx!.sourcePicklistValues).toEqual(['A', 'B', 'C'])
    expect(ctx!.destPicklistValues).toEqual(['X', 'Y', 'Z'])
    expect(ctx!.informationalMessage).toBeNull()
  })

  it('synthesises boolean picklist values as [True, False]', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'boolean',
      dstType: 'picklist',
      dstPicklist: ['Oui', 'Non'],
    })

    const ctx = await buildMigrationLogicContext(fieldMapping.id)
    expect(ctx!.sectionType).toBe('VALUE_EQUIVALENCE')
    expect(ctx!.sourcePicklistValues).toEqual(['True', 'False'])
    expect(ctx!.destPicklistValues).toEqual(['Oui', 'Non'])
  })

  it('returns D4 INFORMATIONAL for text→text with correct message', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'text',
    })

    const ctx = await buildMigrationLogicContext(fieldMapping.id)
    expect(ctx!.sectionType).toBe('INFORMATIONAL')
    expect(ctx!.informationalMessage).toBe('La valeur sera copiée.')
    expect(ctx!.sampleSourceValues).toHaveLength(0)
  })

  it('returns D2 PROMPT for text→picklist with sample values', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'picklist',
      dstPicklist: ['Cat1', 'Cat2'],
    })

    const ctx = await buildMigrationLogicContext(fieldMapping.id)
    expect(ctx!.sectionType).toBe('PROMPT')
    expect(ctx!.sampleSourceValues.length).toBeGreaterThan(0)
    expect(ctx!.informationalMessage).toBeNull()
  })

  it('returns D3 ERROR for text→number', async () => {
    const { fieldMapping } = await seedPlanWithFieldMapping({
      srcType: 'text',
      dstType: 'number',
    })

    const ctx = await buildMigrationLogicContext(fieldMapping.id)
    expect(ctx!.sectionType).toBe('ERROR')
    expect(ctx!.sourcePicklistValues).toHaveLength(0)
    expect(ctx!.destPicklistValues).toHaveLength(0)
  })

  it('returns null for non-existent fieldMappingId', async () => {
    const ctx = await buildMigrationLogicContext('non-existent-id')
    expect(ctx).toBeNull()
  })
})

describe('getSectionType (pure function sanity)', () => {
  const cases: [string, string, string][] = [
    ['picklist', 'picklist', 'VALUE_EQUIVALENCE'],
    ['boolean', 'picklist', 'VALUE_EQUIVALENCE'],
    ['picklist', 'boolean', 'VALUE_EQUIVALENCE'],
    ['text', 'picklist', 'PROMPT'],
    ['number', 'picklist', 'PROMPT'],
    ['date', 'picklist', 'PROMPT'],
    ['text', 'text', 'INFORMATIONAL'],
    ['picklist', 'text', 'INFORMATIONAL'],
    ['boolean', 'text', 'INFORMATIONAL'],
    ['boolean', 'number', 'INFORMATIONAL'],
    ['boolean', 'boolean', 'INFORMATIONAL'],
    ['number', 'text', 'INFORMATIONAL'],
    ['date', 'text', 'INFORMATIONAL'],
    ['text', 'number', 'ERROR'],
    ['text', 'date', 'ERROR'],
    ['text', 'boolean', 'ERROR'],
    ['number', 'boolean', 'ERROR'],
    ['picklist', 'number', 'ERROR'],
    ['date', 'number', 'ERROR'],
  ]

  for (const [src, dst, expected] of cases) {
    it(`${src}→${dst} = ${expected}`, () => {
      expect(getSectionType(src, dst)).toBe(expected)
    })
  }
})
