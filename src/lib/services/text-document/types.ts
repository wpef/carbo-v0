// 019-text-document — Types for the text document generation service

/**
 * A single field row in an object section.
 */
export interface FieldRowData {
  sourceField: string
  destField: string
  typeCompatibility: string
  migrationDescription: string
}

/**
 * All data needed to render one object mapping section.
 */
export interface ObjectSectionData {
  sourceObject: string
  destObject: string
  fields: FieldRowData[]
  filterSummary: string
  unmappedSourceFields: Array<{ apiName: string; label: string; dataType: string; isRequired: boolean }>
  unmappedDestFields: Array<{ apiName: string; label: string; dataType: string; isRequired: boolean }>
}

/**
 * Statistics about the generated document.
 */
export interface GenerationStats {
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
}

/**
 * Structured data assembled before HTML rendering.
 */
export interface TextDocumentData {
  planId: string
  planName: string
  planDescription: string | null
  generatedAt: string
  objectSections: ObjectSectionData[]
  stats: GenerationStats
}

/**
 * The final text document returned by the service.
 */
export interface TextDocument {
  planId: string
  planName: string
  generatedAt: string
  stats: GenerationStats
  html: string
}
