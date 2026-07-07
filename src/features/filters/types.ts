// Types de la feature filtres de migration (02-domain-rules règle 5).

export type FilterOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "IS_NULL"
  | "DATE_AFTER"
  | "DATE_BEFORE";

export interface FilterItem {
  id: string;
  objectMappingId: string;
  fieldApiName: string;
  /** Label du champ, enrichi depuis le snapshot CURRENT (absent si champ disparu). */
  fieldLabel?: string;
  operator: FilterOperator;
  value: string | null;
  isActive: boolean;
  /** Warning souple posé à la création (incohérence type/opérateur). */
  warning?: string;
}

export interface CreateFilterInput {
  fieldApiName: string;
  operator: string;
  value?: string;
}

export interface UpdateFilterInput {
  operator?: string;
  value?: string;
  isActive?: boolean;
}

export interface FilterEstimate {
  estimatedCount: number | null;
  totalCount: number | null;
  isFiltered: boolean;
  isEstimateAvailable: boolean;
  message?: string;
}
