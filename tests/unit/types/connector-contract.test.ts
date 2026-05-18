import { describe, it, expect } from 'vitest'
import { demoAdapter } from '@/lib/adapters/demo/demo-adapter'
import { getAdapter, listAdapterTypes } from '@/lib/adapters/registry'

describe('ConnectorAdapter contract: DemoAdapter', () => {
  it('has all required capabilities flags set', () => {
    expect(demoAdapter.capabilities).toEqual({
      canRead: true,
      canWrite: false,
      canWriteSchema: false,
    })
  })

  it('has all required methods', () => {
    expect(typeof demoAdapter.connect).toBe('function')
    expect(typeof demoAdapter.disconnect).toBe('function')
    expect(typeof demoAdapter.getSchema).toBe('function')
    expect(typeof demoAdapter.getFields).toBe('function')
    expect(typeof demoAdapter.getRecords).toBe('function')
    expect(typeof demoAdapter.getRecordCount).toBe('function')
    expect(typeof demoAdapter.getFieldStats).toBe('function')
  })

  it('connect returns valid ConnectorConnection', async () => {
    const connection = await demoAdapter.connect({ name: 'Test' })
    expect(connection.id).toBeTruthy()
    expect(connection.name).toBe('Test')
    expect(connection.type).toBe('demo')
    expect(connection.status).toBe('CONNECTED')
    expect(connection.config).toEqual({ name: 'Test' })
  })

  it('getSchema returns objects array with 3 objects', async () => {
    const schema = await demoAdapter.getSchema('test-conn')
    expect(schema.objects).toHaveLength(3)
    expect(schema.objects.map((o) => o.apiName)).toEqual(['Contact', 'Account', 'Deal'])
    for (const obj of schema.objects) {
      expect(typeof obj.apiName).toBe('string')
      expect(typeof obj.label).toBe('string')
      expect(typeof obj.isCustom).toBe('boolean')
      expect(typeof obj.isSelected).toBe('boolean')
    }
  })

  it('getFields returns fields with required properties', async () => {
    const fields = await demoAdapter.getFields('test-conn', 'Contact')
    expect(fields.length).toBeGreaterThanOrEqual(5)
    for (const field of fields) {
      expect(typeof field.apiName).toBe('string')
      expect(typeof field.label).toBe('string')
      expect(typeof field.dataType).toBe('string')
      expect(typeof field.isRequired).toBe('boolean')
      expect(typeof field.isReadOnly).toBe('boolean')
      expect(typeof field.isUnique).toBe('boolean')
    }
  })

  it('getRecords with page=1 returns currentPage=1 (FR-012)', async () => {
    const result = await demoAdapter.getRecords('test-conn', 'Contact', 1, 10)
    expect(result.currentPage).toBe(1)
    expect(result.records).toHaveLength(10)
    expect(result.totalCount).toBe(50)
    expect(result.pageSize).toBe(10)
    expect(result.hasNextPage).toBe(true)
  })

  it('getRecords last page has hasNextPage=false', async () => {
    const result = await demoAdapter.getRecords('test-conn', 'Contact', 5, 10)
    expect(result.currentPage).toBe(5)
    expect(result.records).toHaveLength(10)
    expect(result.hasNextPage).toBe(false)
  })

  it('getRecordCount returns 50 for each object', async () => {
    for (const obj of ['Contact', 'Account', 'Deal']) {
      const count = await demoAdapter.getRecordCount('test-conn', obj)
      expect(count).toBe(50)
    }
  })

  it('getFieldStats returns matching field names', async () => {
    const stats = await demoAdapter.getFieldStats('test-conn', 'Contact', ['Email', 'Phone'])
    expect(stats).toHaveLength(2)
    expect(stats[0].fieldApiName).toBe('Email')
    expect(stats[1].fieldApiName).toBe('Phone')
    for (const stat of stats) {
      expect(typeof stat.nullCount).toBe('number')
      expect(typeof stat.distinctCount).toBe('number')
      expect(Array.isArray(stat.sampleValues)).toBe(true)
      expect(stat.sampleValues.length).toBeLessThanOrEqual(5)
    }
  })

  it('Phone field has expected null count', async () => {
    const stats = await demoAdapter.getFieldStats('test-conn', 'Contact', ['Phone'])
    expect(stats[0].nullCount).toBeGreaterThan(0)
  })

  it('createObject/createField are undefined when canWriteSchema=false', () => {
    expect(demoAdapter.createObject).toBeUndefined()
    expect(demoAdapter.createField).toBeUndefined()
  })
})

describe('Adapter Registry', () => {
  it('resolves "demo" to DemoAdapter', () => {
    const adapter = getAdapter('demo')
    expect(adapter).toBe(demoAdapter)
  })

  it('throws for unknown adapter type', () => {
    expect(() => getAdapter('nonexistent')).toThrow('Unknown adapter type')
  })

  it('lists available adapter types', () => {
    const types = listAdapterTypes()
    expect(types).toContain('demo')
  })
})
