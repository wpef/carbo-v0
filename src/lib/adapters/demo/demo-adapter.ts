import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorSchema,
  ConnectorObject,
  ConnectorField,
  FieldModification,
  PaginatedRecords,
  FieldStats,
} from '@/lib/types/connector'

// Mutable objects list — modified in-memory by createObject (022 T009)
const DEMO_OBJECTS: ConnectorObject[] = [
  { apiName: 'Contact', label: 'Contact', isCustom: false, isSelected: true },
  { apiName: 'Account', label: 'Account', isCustom: false, isSelected: true },
  { apiName: 'Deal', label: 'Deal', isCustom: false, isSelected: true },
]

const DEMO_FIELDS: Record<string, ConnectorField[]> = {
  Contact: [
    { apiName: 'Id', label: 'Contact ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'FirstName', label: 'First Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'Email', label: 'Email', dataType: 'email', isRequired: true, isReadOnly: false, isUnique: true },
    { apiName: 'Phone', label: 'Phone', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'AccountId', label: 'Account', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'Account', relationshipType: 'lookup' },
    { apiName: 'CreatedDate', label: 'Created Date', dataType: 'datetime', isRequired: true, isReadOnly: true, isUnique: false },
  ],
  Account: [
    { apiName: 'Id', label: 'Account ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'Name', label: 'Account Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'Industry', label: 'Industry', dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'Website', label: 'Website', dataType: 'url', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'AnnualRevenue', label: 'Annual Revenue', dataType: 'currency', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'NumberOfEmployees', label: 'Employees', dataType: 'int', isRequired: false, isReadOnly: false, isUnique: false },
  ],
  Deal: [
    { apiName: 'Id', label: 'Deal ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'Name', label: 'Deal Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'Amount', label: 'Amount', dataType: 'currency', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'Stage', label: 'Stage', dataType: 'picklist', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'CloseDate', label: 'Close Date', dataType: 'date', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'AccountId', label: 'Account', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'Account', relationshipType: 'lookup' },
    { apiName: 'ContactId', label: 'Primary Contact', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'Contact', relationshipType: 'lookup' },
    { apiName: 'Probability', label: 'Probability (%)', dataType: 'percent', isRequired: false, isReadOnly: false, isUnique: false },
  ],
}

const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education', 'Energy', null]
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

function generateRecords(objectApiName: string, count: number): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    switch (objectApiName) {
      case 'Contact':
        records.push({
          Id: `CON-${String(i + 1).padStart(4, '0')}`,
          FirstName: FIRST_NAMES[i % FIRST_NAMES.length],
          LastName: LAST_NAMES[i % LAST_NAMES.length],
          Email: `${FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()}.${LAST_NAMES[i % LAST_NAMES.length].toLowerCase()}@example.com`,
          Phone: i % 3 === 0 ? null : `+1-555-${String(1000 + i).slice(-4)}`,
          AccountId: `ACC-${String((i % 10) + 1).padStart(4, '0')}`,
          CreatedDate: new Date(2024, 0, 1 + i).toISOString(),
        })
        break
      case 'Account':
        records.push({
          Id: `ACC-${String(i + 1).padStart(4, '0')}`,
          Name: `${LAST_NAMES[i % LAST_NAMES.length]} ${INDUSTRIES[i % (INDUSTRIES.length - 1)] ?? 'Corp'}`,
          Industry: INDUSTRIES[i % INDUSTRIES.length],
          Website: i % 4 === 0 ? null : `https://${LAST_NAMES[i % LAST_NAMES.length].toLowerCase()}.example.com`,
          AnnualRevenue: i % 5 === 0 ? null : (i + 1) * 100000,
          NumberOfEmployees: i % 3 === 0 ? null : (i + 1) * 10,
        })
        break
      case 'Deal':
        records.push({
          Id: `DEAL-${String(i + 1).padStart(4, '0')}`,
          Name: `Deal #${i + 1} - ${LAST_NAMES[i % LAST_NAMES.length]}`,
          Amount: i % 4 === 0 ? null : (i + 1) * 5000,
          Stage: STAGES[i % STAGES.length],
          CloseDate: new Date(2024, 6, 1 + i).toISOString().split('T')[0],
          AccountId: `ACC-${String((i % 10) + 1).padStart(4, '0')}`,
          ContactId: i % 3 === 0 ? null : `CON-${String((i % 20) + 1).padStart(4, '0')}`,
          Probability: STAGES[i % STAGES.length] === 'Closed Won' ? 100 : STAGES[i % STAGES.length] === 'Closed Lost' ? 0 : (i % 10) * 10 + 10,
        })
        break
    }
  }
  return records
}

const RECORD_STORE: Record<string, Record<string, unknown>[]> = {
  Contact: generateRecords('Contact', 50),
  Account: generateRecords('Account', 50),
  Deal: generateRecords('Deal', 50),
}

export const demoAdapter: ConnectorAdapter = {
  capabilities: {
    canRead: true,
    canWrite: false,
    canWriteSchema: true,
    // 022 T009 — types accepted when creating or modifying destination fields
    supportedFieldTypes: ['string', 'number', 'date', 'datetime', 'enumeration', 'bool'],
  },

  async connect(config) {
    console.log('[DemoAdapter] connect', config)
    return {
      id: `demo-${Date.now()}`,
      name: (config.name as string) || 'Demo Connection',
      type: 'demo',
      status: 'CONNECTED',
      config,
    }
  },

  async disconnect(connectionId) {
    console.log('[DemoAdapter] disconnect', connectionId)
  },

  async getSchema() {
    return { objects: [...DEMO_OBJECTS] }
  },

  async getFields(_connectionId, objectApiName) {
    const fields = DEMO_FIELDS[objectApiName]
    if (!fields) throw new Error(`Unknown object: ${objectApiName}`)
    return fields
  },

  async getRecords(_connectionId, objectApiName, page, pageSize) {
    const allRecords = RECORD_STORE[objectApiName]
    if (!allRecords) throw new Error(`Unknown object: ${objectApiName}`)
    const start = (page - 1) * pageSize
    const slice = allRecords.slice(start, start + pageSize)
    return {
      records: slice,
      totalCount: allRecords.length,
      pageSize,
      currentPage: page,
      hasNextPage: start + pageSize < allRecords.length,
    }
  },

  async getRecordCount(_connectionId, objectApiName) {
    const allRecords = RECORD_STORE[objectApiName]
    if (!allRecords) throw new Error(`Unknown object: ${objectApiName}`)
    return allRecords.length
  },

  async getFieldStats(_connectionId, objectApiName, fieldApiNames) {
    const allRecords = RECORD_STORE[objectApiName]
    if (!allRecords) throw new Error(`Unknown object: ${objectApiName}`)
    return fieldApiNames.map((fieldApiName) => {
      const values = allRecords.map((r) => r[fieldApiName])
      const nonNull = values.filter((v) => v !== null && v !== undefined)
      const unique = [...new Set(nonNull.map((v) => JSON.stringify(v)))]
      return {
        fieldApiName,
        nullCount: values.length - nonNull.length,
        distinctCount: unique.length,
        sampleValues: unique.slice(0, 5).map((v) => JSON.parse(v)),
      }
    })
  },

  // ─── 022: Schema write (canWriteSchema=true) ──────────────────────────────

  /**
   * Create a new custom object in the in-memory demo schema. (022 T009)
   * Validates name uniqueness; returns the new ConnectorObject.
   */
  async createObject(_connectionId, object) {
    console.log('[DemoAdapter] createObject', object)

    const existing = DEMO_OBJECTS.find((o) => o.apiName === object.apiName)
    if (existing) {
      throw new Error(`Object '${object.apiName}' already exists in the demo schema`)
    }

    const newObject: ConnectorObject = {
      apiName: object.apiName,
      label: object.label,
      description: object.description,
      isCustom: true,
      isSelected: false,
    }
    DEMO_OBJECTS.push(newObject)

    // Initialise empty field list for the new object so getFields doesn't throw
    if (!DEMO_FIELDS[object.apiName]) {
      DEMO_FIELDS[object.apiName] = []
    }

    console.log(`[DemoAdapter] createObject — created '${object.apiName}', total objects: ${DEMO_OBJECTS.length}`)
    return newObject
  },

  /**
   * Add a new field to an existing in-memory demo object. (022 T009)
   * Validates object existence and name uniqueness; returns the new ConnectorField.
   */
  async createField(_connectionId, objectApiName, field) {
    console.log('[DemoAdapter] createField', objectApiName, field.apiName)

    if (DEMO_FIELDS[objectApiName] === undefined) {
      throw new Error(`Object '${objectApiName}' does not exist in the demo schema`)
    }

    const fields = DEMO_FIELDS[objectApiName]
    const existing = fields.find((f) => f.apiName === field.apiName)
    if (existing) {
      throw new Error(`Field '${field.apiName}' already exists on object '${objectApiName}'`)
    }

    const newField: ConnectorField = {
      apiName: field.apiName,
      label: field.label,
      dataType: field.dataType,
      isRequired: field.isRequired ?? false,
      isReadOnly: false,
      isUnique: false,
      isAccessible: true,
      picklistValues: field.picklistValues,
    }
    fields.push(newField)

    console.log(`[DemoAdapter] createField — added '${field.apiName}' to '${objectApiName}', total fields: ${fields.length}`)
    return newField
  },

  /**
   * Update properties of an existing demo field in-memory. (022 T009)
   * Validates field existence; applies only the provided updates.
   */
  async modifyField(_connectionId, objectApiName, fieldApiName, updates: FieldModification) {
    console.log('[DemoAdapter] modifyField', objectApiName, fieldApiName, updates)

    const fields = DEMO_FIELDS[objectApiName]
    if (!fields) {
      throw new Error(`Object '${objectApiName}' does not exist in the demo schema`)
    }

    const fieldIndex = fields.findIndex((f) => f.apiName === fieldApiName)
    if (fieldIndex === -1) {
      throw new Error(`Field '${fieldApiName}' does not exist on object '${objectApiName}'`)
    }

    // If renaming, check the new name is not already taken
    if (updates.name && updates.name !== fieldApiName) {
      const nameConflict = fields.find((f) => f.apiName === updates.name)
      if (nameConflict) {
        throw new Error(`Field '${updates.name}' already exists on object '${objectApiName}'`)
      }
    }

    const current = fields[fieldIndex]
    const updated: ConnectorField = {
      ...current,
      apiName: updates.name ?? current.apiName,
      label: updates.label ?? current.label,
      dataType: updates.type ?? current.dataType,
      picklistValues: updates.picklistValues !== undefined ? updates.picklistValues : current.picklistValues,
    }
    fields[fieldIndex] = updated

    console.log(`[DemoAdapter] modifyField — updated '${fieldApiName}' on '${objectApiName}'`)
    return updated
  },
}

// Test-only: the demo schema is mutated in place by createObject/createField/modifyField (022).
// This restores the pristine schema so schema-write tests don't pollute other suites.
const INITIAL_DEMO_OBJECTS = JSON.parse(JSON.stringify(DEMO_OBJECTS))
const INITIAL_DEMO_FIELDS = JSON.parse(JSON.stringify(DEMO_FIELDS))
export function __resetDemoSchemaForTests(): void {
  DEMO_OBJECTS.length = 0
  DEMO_OBJECTS.push(...(JSON.parse(JSON.stringify(INITIAL_DEMO_OBJECTS)) as typeof DEMO_OBJECTS))
  for (const k of Object.keys(DEMO_FIELDS)) delete DEMO_FIELDS[k]
  Object.assign(DEMO_FIELDS, JSON.parse(JSON.stringify(INITIAL_DEMO_FIELDS)))
}
