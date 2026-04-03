// Demo Source Adapter — provides mock data for development and demos

import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorSchema,
  ConnectorField,
  PaginatedRecords,
  FieldStats,
} from '@/lib/connectors/types'

const DEMO_SCHEMA: ConnectorSchema = {
  objects: [
    {
      apiName: 'Contact',
      label: 'Contact',
      description: 'A person associated with an account',
      isCustom: false,
      isSelected: false,
    },
    {
      apiName: 'Account',
      label: 'Account',
      description: 'A company or organisation',
      isCustom: false,
      isSelected: false,
    },
    {
      apiName: 'Deal',
      label: 'Deal',
      description: 'A sales opportunity',
      isCustom: false,
      isSelected: false,
    },
  ],
}

const DEMO_FIELDS: Record<string, ConnectorField[]> = {
  Contact: [
    { apiName: 'id', label: 'ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'firstName', label: 'First Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'lastName', label: 'Last Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'email', label: 'Email', dataType: 'email', isRequired: false, isReadOnly: false, isUnique: true },
    { apiName: 'phone', label: 'Phone', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'accountId', label: 'Account', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'Account', relationshipType: 'ManyToOne' },
  ],
  Account: [
    { apiName: 'id', label: 'ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'name', label: 'Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'industry', label: 'Industry', dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'website', label: 'Website', dataType: 'url', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'employeeCount', label: 'Employee Count', dataType: 'integer', isRequired: false, isReadOnly: false, isUnique: false },
  ],
  Deal: [
    { apiName: 'id', label: 'ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'name', label: 'Deal Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'amount', label: 'Amount', dataType: 'currency', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'stage', label: 'Stage', dataType: 'picklist', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'closeDate', label: 'Close Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'accountId', label: 'Account', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'Account', relationshipType: 'ManyToOne' },
  ],
}

const DEMO_RECORDS: Record<string, Array<Record<string, unknown>>> = {
  Contact: [
    { id: 'c001', firstName: 'Alice', lastName: 'Martin', email: 'alice.martin@example.com', phone: '+33 6 00 00 00 01', accountId: 'a001' },
    { id: 'c002', firstName: 'Bob', lastName: 'Dupont', email: 'bob.dupont@example.com', phone: '+33 6 00 00 00 02', accountId: 'a001' },
    { id: 'c003', firstName: 'Claire', lastName: 'Bernard', email: 'claire.bernard@example.com', phone: null, accountId: 'a002' },
  ],
  Account: [
    { id: 'a001', name: 'Acme Corp', industry: 'Technology', website: 'https://acme.example.com', employeeCount: 250 },
    { id: 'a002', name: 'Beta Industries', industry: 'Manufacturing', website: null, employeeCount: 45 },
  ],
  Deal: [
    { id: 'd001', name: 'Acme Expansion', amount: 50000, stage: 'Negotiation', closeDate: '2026-06-30', accountId: 'a001' },
    { id: 'd002', name: 'Beta Starter', amount: 8500, stage: 'Proposal', closeDate: '2026-05-15', accountId: 'a002' },
  ],
}

export class DemoSourceAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = false
  readonly canWriteSchema = false

  async connect(_config: Record<string, unknown>): Promise<ConnectorConnection> {
    return {
      id: 'demo-connection',
      name: 'Demo Data Source',
      type: 'demo',
      status: 'CONNECTED',
      config: {},
    }
  }

  async disconnect(_connectionId: string): Promise<void> {
    // No-op for demo adapter
  }

  async getSchema(_connectionId: string): Promise<ConnectorSchema> {
    return DEMO_SCHEMA
  }

  async getFields(_connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    return DEMO_FIELDS[objectApiName] ?? []
  }

  async getRecords(_connectionId: string, objectApiName: string, page: number, pageSize: number): Promise<PaginatedRecords> {
    const all = DEMO_RECORDS[objectApiName] ?? []
    const start = (page - 1) * pageSize
    const records = all.slice(start, start + pageSize)
    return {
      records,
      totalCount: all.length,
      pageSize,
      currentPage: page,
      hasNextPage: start + pageSize < all.length,
    }
  }

  async getRecordCount(_connectionId: string, objectApiName: string): Promise<number> {
    return (DEMO_RECORDS[objectApiName] ?? []).length
  }

  async getFieldStats(_connectionId: string, objectApiName: string, fieldApiName: string): Promise<FieldStats> {
    const records = DEMO_RECORDS[objectApiName] ?? []
    const values = records.map((r) => r[fieldApiName])
    const nullCount = values.filter((v) => v === null || v === undefined).length
    const distinctValues = [...new Set(values.filter((v) => v !== null && v !== undefined))]
    return {
      fieldApiName,
      nullCount,
      distinctCount: distinctValues.length,
      sampleValues: distinctValues.slice(0, 5),
    }
  }
}
