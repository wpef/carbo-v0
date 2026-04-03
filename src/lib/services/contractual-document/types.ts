// 020-contractual-document — Types for contractual document generation

/**
 * A single article (section) in the contractual document.
 */
export interface Article {
  number: number
  title: string
  content: string // HTML fragment
}

/**
 * Full structured contractual document returned by the service.
 */
export interface ContractualDocument {
  planId: string
  planName: string
  referenceNumber: string
  generatedAt: string
  articles: Article[]
  html: string
  stats: GenerationStats
}

/**
 * Generation statistics embedded in the document and audit trail.
 */
export interface GenerationStats {
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
}

/**
 * Data representing one row in a correspondence table.
 */
export interface CorrespondenceRow {
  sourceField: string
  destField: string
  typeCompatibility: string
  migrationDescription: string
}

/**
 * Scope data for Article 1.
 */
export interface ScopeData {
  sourceName: string
  destName: string
  objectCount: number
  fieldCount: number
  filterCount: number
}

/**
 * Signature block data for Article 7.
 */
export interface SignatureBlockData {
  consultantName: string
  clientName: string
  generationDate: string
}
