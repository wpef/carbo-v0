// 022-schema-write — TypeScript types for schema write operations.
// All DTOs mirror the data-model.md contracts exactly.

// ---------------------------------------------------------------------------
// Request types (FR-002, FR-004, FR-007)
// ---------------------------------------------------------------------------

/**
 * Input to create a new field on a destination object. (FR-002)
 * `type` must be in the adapter's `supportedFieldTypes`.
 * `picklistValues` is required when type is 'picklist' or 'enumeration'.
 */
export interface CreateFieldRequest {
  /** Target destination object API name. */
  objectApiName: string
  /** Field API name — must be unique on the object. */
  name: string
  /** Human-readable display label. */
  label: string
  /** Field type — must be in adapter.capabilities.supportedFieldTypes. */
  type: string
  /** Optional description; may be LLM-generated (FR-005). */
  description?: string
  /** Required when type is 'picklist' or 'enumeration' (FR-002). */
  picklistValues?: string[]
  /** Optional property group (HubSpot property group / Salesforce field set). */
  group?: string
}

/**
 * Input to modify an existing destination field. (FR-004)
 * All update properties are optional — only provided keys are modified.
 */
export interface ModifyFieldRequest {
  /** Object containing the field. */
  objectApiName: string
  /** API name of the field to modify. */
  fieldApiName: string
  updates: {
    /** Rename the field (if the destination system supports it). */
    name?: string
    /** Update the display label. */
    label?: string
    /** Change the data type (if the destination system supports it). */
    type?: string
    /** Update the description. */
    description?: string
    /** Update picklist values (for picklist/enumeration fields). */
    picklistValues?: string[]
    /** Move the field to a different property group. */
    group?: string
  }
}

/**
 * Input to create a new custom object on the destination. (FR-007)
 */
export interface CreateObjectRequest {
  /** Object API name — must be unique on the destination. */
  name: string
  /** Human-readable display label. */
  label: string
  /** Optional description. */
  description?: string
  /** Primary property definition (required for custom objects). */
  primaryProperty: {
    name: string
    label: string
    /** Type of the primary property — usually 'string'. */
    type: string
  }
}

/**
 * Input to generate an LLM field description. (FR-005)
 * `sampleValues` are only included when GDPR configuration permits it.
 */
export interface GenerateDescriptionRequest {
  objectApiName: string
  objectLabel: string
  fieldName: string
  fieldType: string
  /** Up to 5 sample values from the source (GDPR-gated). */
  sampleValues?: unknown[]
  /** Company / market metaprompt configured at plan or project level. */
  companyContext?: string
}

// ---------------------------------------------------------------------------
// Response / DTO types
// ---------------------------------------------------------------------------

/**
 * Response from the LLM description generator. (FR-005)
 */
export interface GenerateDescriptionResponse {
  /** LLM-generated field description. Always reviewed by the consultant before saving. */
  description: string
  /** Model used, e.g. 'claude-sonnet-4-20250514'. */
  model: string
  /** Total tokens used for cost tracking. */
  tokensUsed: number
}

/**
 * Serialised audit record returned in API responses. (FR-010)
 */
export interface SchemaWriteOperationDTO {
  id: string
  connectionId: string
  operationType: 'CREATE_OBJECT' | 'CREATE_FIELD' | 'MODIFY_FIELD'
  targetObjectApiName: string
  details: Record<string, unknown>
  result: 'SUCCESS' | 'ERROR'
  errorMessage: string | null
  /** ISO 8601 timestamp. */
  createdAt: string
}

// ---------------------------------------------------------------------------
// Internal validation result
// ---------------------------------------------------------------------------

/** Returned by field validator functions. */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] }
