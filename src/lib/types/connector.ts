export interface ConnectorConnection {
  id: string
  name: string
  type: string
  status: 'CONNECTED' | 'EXPIRED' | 'ERROR'
  config: Record<string, unknown>
}

export interface ConnectorSchema {
  objects: ConnectorObject[]
}

export interface ConnectorObject {
  apiName: string
  label: string
  description?: string
  isCustom: boolean
  isSelected: boolean
}

export interface ConnectorField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  /** false when the authenticated user cannot read this field (005 FR-003). Defaults to true when absent. */
  isAccessible?: boolean
  referenceTo?: string
  relationshipType?: 'lookup' | 'master-detail' | 'external'
  /** Picklist / enumeration values (005 FR-004). Present only for picklist / enumeration dataTypes. */
  picklistValues?: string[]
}

export type ConnectorRecord = Record<string, unknown>

export interface FieldStats {
  fieldApiName: string
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]
}

/** page is 1-indexed (FR-012). page=1 returns the first pageSize records. */
export interface PaginatedRecords {
  records: ConnectorRecord[]
  totalCount: number
  pageSize: number
  currentPage: number
  hasNextPage: boolean
}

export interface SchemaDiffResult {
  addedObjects: string[]
  removedObjects: string[]
  modifiedObjects: {
    apiName: string
    addedFields: string[]
    removedFields: string[]
    modifiedFields: {
      apiName: string
      changes: Record<string, { before: unknown; after: unknown }>
    }[]
  }[]
}

export interface ConnectorCapabilities {
  canRead: boolean
  canWrite: boolean
  canWriteSchema: boolean
}

export interface ConnectorAdapter {
  readonly capabilities: ConnectorCapabilities

  connect(config: Record<string, unknown>): Promise<ConnectorConnection>
  disconnect(connectionId: string): Promise<void>

  getSchema(connectionId: string): Promise<ConnectorSchema>
  getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]>
  /** page is 1-indexed (FR-012). page=1 returns the first pageSize records. */
  getRecords(connectionId: string, objectApiName: string, page: number, pageSize: number): Promise<PaginatedRecords>
  getRecordCount(connectionId: string, objectApiName: string): Promise<number>
  getFieldStats(connectionId: string, objectApiName: string, fieldApiNames: string[]): Promise<FieldStats[]>

  createObject?(connectionId: string, object: { apiName: string; label: string; description?: string }): Promise<ConnectorObject>
  createField?(connectionId: string, objectApiName: string, field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>): Promise<ConnectorField>
}
