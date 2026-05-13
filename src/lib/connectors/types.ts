// 000-connector-interface — Core types and adapter interface

// --- Enums ---

export const ConnectionStatus = {
  CONNECTED: 'CONNECTED',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
} as const

export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus]

// --- Core Types ---

export interface ConnectorConnection {
  id: string
  name: string
  type: string // adapter identifier (e.g., "salesforce", "hubspot")
  status: ConnectionStatus
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
  referenceTo?: string
  relationshipType?: string
  description?: string
  picklistValues?: string[]
  group?: string
}

export type ConnectorRecord = Record<string, unknown>

export interface FieldStats {
  fieldApiName: string
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]
}

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
    modifiedFields: string[]
  }[]
}

// --- Adapter Interface ---

export interface ConnectorAdapter {
  // Capability flags
  readonly canRead: boolean
  readonly canWrite: boolean
  readonly canWriteSchema: boolean

  // Connection
  connect(config: Record<string, unknown>): Promise<ConnectorConnection>
  disconnect(connectionId: string): Promise<void>

  // Schema
  getSchema(connectionId: string): Promise<ConnectorSchema>
  getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]>

  // Records
  /**
   * Fetch a paginated page of records.
   * `page` is **1-indexed** (page=1 returns the first pageSize records).
   * Convention: the demo and destination adapters use 1-indexed; SF and HubSpot
   * adapters were originally 0-indexed but were corrected on 2026-05-12 after
   * a live test showed records with index < pageSize were never returned.
   */
  getRecords(connectionId: string, objectApiName: string, page: number, pageSize: number): Promise<PaginatedRecords>
  getRecordCount(connectionId: string, objectApiName: string): Promise<number>
  getFieldStats(connectionId: string, objectApiName: string, fieldApiName: string): Promise<FieldStats>

  // Schema write (optional — only when canWriteSchema is true)
  createObject?(connectionId: string, apiName: string, label: string): Promise<ConnectorObject>
  createField?(connectionId: string, objectApiName: string, field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>): Promise<ConnectorField>
}
