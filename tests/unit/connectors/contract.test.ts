import { describe, it, expect } from 'vitest'
import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorSchema,
  ConnectorField,
  ConnectorRecord,
  FieldStats,
  PaginatedRecords,
  ConnectorObject,
} from '@/lib/connectors'
import { ConnectionStatus } from '@/lib/connectors'

// Full read/write mock adapter
class MockAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = true
  readonly canWriteSchema = true

  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    return {
      id: 'mock-1',
      name: 'Mock Connection',
      type: 'mock',
      status: ConnectionStatus.CONNECTED,
      config,
    }
  }

  async disconnect(): Promise<void> {}

  async getSchema(_connectionId: string): Promise<ConnectorSchema> {
    return {
      objects: [
        { apiName: 'Contact', label: 'Contact', isCustom: false, isSelected: false },
      ],
    }
  }

  async getFields(_connectionId: string, _objectApiName: string): Promise<ConnectorField[]> {
    return [
      {
        apiName: 'email',
        label: 'Email',
        dataType: 'text',
        isRequired: true,
        isReadOnly: false,
        isUnique: true,
      },
    ]
  }

  async getRecords(_connectionId: string, _objectApiName: string, _page: number, _pageSize: number): Promise<PaginatedRecords> {
    return {
      records: [{ email: 'test@example.com' } as ConnectorRecord],
      totalCount: 1,
      pageSize: 10,
      currentPage: 1,
      hasNextPage: false,
    }
  }

  async getRecordCount(_connectionId: string, _objectApiName: string): Promise<number> {
    return 1
  }

  async getFieldStats(_connectionId: string, _objectApiName: string, _fieldApiName: string): Promise<FieldStats> {
    return {
      fieldApiName: 'email',
      nullCount: 0,
      distinctCount: 1,
      sampleValues: ['test@example.com'],
    }
  }

  async createObject(_connId: string, apiName: string, label: string): Promise<ConnectorObject> {
    return { apiName, label, isCustom: true, isSelected: false }
  }

  async createField(_connId: string, _objName: string, field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>): Promise<ConnectorField> {
    return { ...field, isReadOnly: false, isUnique: false }
  }
}

// Read-only mock (canWriteSchema=false, no createObject/createField)
class ReadOnlyAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = false
  readonly canWriteSchema = false

  async connect(config: Record<string, unknown>): Promise<ConnectorConnection> {
    return { id: 'ro-1', name: 'Read Only', type: 'readonly', status: ConnectionStatus.CONNECTED, config }
  }
  async disconnect(): Promise<void> {}
  async getSchema(_connectionId: string): Promise<ConnectorSchema> {
    return { objects: [] }
  }
  async getFields(_connectionId: string, _objectApiName: string): Promise<ConnectorField[]> {
    return []
  }
  async getRecords(_connectionId: string, _objectApiName: string, _page: number, _pageSize: number): Promise<PaginatedRecords> {
    return { records: [], totalCount: 0, pageSize: 10, currentPage: 1, hasNextPage: false }
  }
  async getRecordCount(_connectionId: string, _objectApiName: string): Promise<number> {
    return 0
  }
  async getFieldStats(_connectionId: string, _objectApiName: string, _fieldApiName: string): Promise<FieldStats> {
    return { fieldApiName: '', nullCount: 0, distinctCount: 0, sampleValues: [] }
  }
}

describe('ConnectorAdapter contract', () => {
  it('MockAdapter satisfies the full ConnectorAdapter interface', () => {
    const adapter: ConnectorAdapter = new MockAdapter()
    expect(adapter.canRead).toBe(true)
    expect(adapter.canWrite).toBe(true)
    expect(adapter.canWriteSchema).toBe(true)
  })

  it('connect returns a ConnectorConnection with correct status', async () => {
    const adapter = new MockAdapter()
    const conn = await adapter.connect({ token: 'abc' })
    expect(conn.id).toBeDefined()
    expect(conn.status).toBe(ConnectionStatus.CONNECTED)
    expect(conn.type).toBe('mock')
  })

  it('getSchema returns ConnectorSchema with objects array', async () => {
    const adapter = new MockAdapter()
    const schema = await adapter.getSchema('mock-1')
    expect(Array.isArray(schema.objects)).toBe(true)
    expect(schema.objects[0].apiName).toBe('Contact')
  })

  it('getFields returns ConnectorField array with required metadata', async () => {
    const adapter = new MockAdapter()
    const fields = await adapter.getFields('mock-1', 'Contact')
    expect(fields[0].apiName).toBe('email')
    expect(typeof fields[0].isRequired).toBe('boolean')
    expect(typeof fields[0].isReadOnly).toBe('boolean')
    expect(typeof fields[0].isUnique).toBe('boolean')
  })

  it('getRecords returns PaginatedRecords', async () => {
    const adapter = new MockAdapter()
    const result = await adapter.getRecords('mock-1', 'Contact', 1, 10)
    expect(Array.isArray(result.records)).toBe(true)
    expect(typeof result.totalCount).toBe('number')
    expect(typeof result.hasNextPage).toBe('boolean')
  })

  it('getFieldStats returns FieldStats', async () => {
    const adapter = new MockAdapter()
    const stats = await adapter.getFieldStats('mock-1', 'Contact', 'email')
    expect(stats.fieldApiName).toBe('email')
    expect(typeof stats.nullCount).toBe('number')
    expect(Array.isArray(stats.sampleValues)).toBe(true)
  })

  it('createObject returns ConnectorObject (write-capable adapter)', async () => {
    const adapter = new MockAdapter()
    const obj = await adapter.createObject!('mock-1', 'CustomObj', 'Custom Object')
    expect(obj.apiName).toBe('CustomObj')
    expect(obj.isCustom).toBe(true)
  })

  it('ReadOnlyAdapter compiles without createObject/createField', () => {
    const adapter: ConnectorAdapter = new ReadOnlyAdapter()
    expect(adapter.canRead).toBe(true)
    expect(adapter.canWriteSchema).toBe(false)
    expect(adapter.createObject).toBeUndefined()
    expect(adapter.createField).toBeUndefined()
  })

  it('ConnectionStatus enum has all expected values', () => {
    expect(ConnectionStatus.CONNECTED).toBe('CONNECTED')
    expect(ConnectionStatus.EXPIRED).toBe('EXPIRED')
    expect(ConnectionStatus.ERROR).toBe('ERROR')
  })
})
