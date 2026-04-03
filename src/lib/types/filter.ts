// 015-migration-filters — TypeScript types for migration filters

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_NULL'
  | 'IS_NOT_NULL'
  | 'IN'
  | 'NOT_IN'

export interface MigrationFilterDTO {
  id: string
  objectMappingId: string
  fieldApiName: string
  fieldLabel?: string
  operator: FilterOperator
  value: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
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

export interface FilterableField {
  apiName: string
  label: string
  dataType: string
}

export const FILTER_OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: 'EQUALS', label: 'equals', needsValue: true },
  { value: 'NOT_EQUALS', label: 'does not equal', needsValue: true },
  { value: 'CONTAINS', label: 'contains', needsValue: true },
  { value: 'NOT_CONTAINS', label: 'does not contain', needsValue: true },
  { value: 'GREATER_THAN', label: 'greater than', needsValue: true },
  { value: 'LESS_THAN', label: 'less than', needsValue: true },
  { value: 'IS_NULL', label: 'is null', needsValue: false },
  { value: 'IS_NOT_NULL', label: 'is not null', needsValue: false },
  { value: 'IN', label: 'is in', needsValue: true },
  { value: 'NOT_IN', label: 'is not in', needsValue: true },
]
