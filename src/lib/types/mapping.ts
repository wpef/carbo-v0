// 011-object-mapping — TypeScript types for object mapping

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
