// 011-object-mapping — TypeScript types for object mapping
// 013-migration-logic — Extended with MigrationLogic types

export interface ObjectMappingDTO {
  id: string
  planId: string
  sourceObjectId: string
  sourceObjectApiName: string
  sourceObjectLabel: string
  destObjectId: string
  destObjectApiName: string
  destObjectLabel: string
  status: 'ACTIVE' | 'BROKEN'
  createdAt: string
  updatedAt: string
}

export interface CreateObjectMappingInput {
  sourceObjectId: string
  sourceObjectApiName: string
  destObjectId: string
  destObjectApiName: string
}

export interface UnmappedSourceObject {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
}

export interface AvailableDestObject {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
}

export interface AutoLinkPair {
  sourceApiName: string
  destApiName: string
}

export interface AutoLinkResult {
  created: number
  skipped: number
  pairs: Array<{ sourceApiName: string; destApiName: string; status: 'created' | 'skipped' }>
}

export enum LinkState {
  IDLE = 'IDLE',
  SOURCE_SELECTED = 'SOURCE_SELECTED',
}

// --- 013 Migration Logic ---

export type SectionType = 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'
export type MigrationLogicStatus = 'DRAFT' | 'DEFINED' | 'VALIDATED' | 'INCOMPATIBLE'

export interface ValueEquivalenceDTO {
  id: string
  migrationLogicId: string
  sourceValue: string
  destinationValue: string
}

export interface ClassificationPromptDTO {
  id: string
  migrationLogicId: string
  promptText: string
}

export interface MigrationLogicDTO {
  id: string
  fieldMappingId: string
  sectionType: SectionType
  status: MigrationLogicStatus
  valueEquivalences: ValueEquivalenceDTO[]
  classificationPrompt: ClassificationPromptDTO | null
  createdAt: string
  updatedAt: string
}

export interface SaveMigrationLogicInput {
  sectionType: SectionType
  status: MigrationLogicStatus
  valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
  promptText?: string
}

export interface ClassifyRequest {
  promptText: string
  destinationValues: string[]
  sampleSourceValues: string[]
}

export interface ClassifyResult {
  sourceValue: string
  classification: string | null
  error?: string
}

export interface ClassifyResponse {
  classifications: ClassifyResult[]
}
