// 015-migration-filters — Shared TypeScript types
// Operators align with the FilterOperator enum in prisma/schema.prisma

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_NULL'
  | 'DATE_AFTER'
  | 'DATE_BEFORE'

export interface FilterItem {
  id: string
  objectMappingId: string
  fieldApiName: string
  fieldLabel?: string       // enriched from schema snapshot (optional)
  operator: FilterOperator
  value: string | null
  isActive: boolean
  warning?: string          // soft warning returned at creation time (type-operator mismatch)
  // Note: v4 Prisma schema has no createdAt/updatedAt on MigrationFilter
  createdAt?: string
  updatedAt?: string
}

export interface CreateFilterInput {
  fieldApiName: string
  operator: FilterOperator
  value?: string
}

export interface UpdateFilterInput {
  operator?: FilterOperator
  value?: string | null
  isActive?: boolean
}

export interface FilterListResponse {
  filters: FilterItem[]
  count: number
}

export interface FilterableField {
  apiName: string
  label: string
  dataType: string
}

export interface FilterEstimate {
  estimatedCount: number | null
  totalCount: number | null
  isFiltered: boolean
  isEstimateAvailable: boolean
  message?: string
}
