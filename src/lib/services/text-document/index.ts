// 019-text-document — Public barrel export

export type { TextDocument, TextDocumentData, ObjectSectionData, FieldRowData, GenerationStats } from './types'
export { generateTextDocument } from './text-document.service'
export { buildFullDocument, buildSummarySection, buildObjectSection, buildTableOfContents, buildStatisticsSection } from './template-builder'
export { storeDocument, listDocuments, getDocument } from './document-store'
export type { StoredTextDocument } from './document-store'
