// 005-source-field-retrieval — Field retrieval types

export interface ObjectFieldResult {
  id: string
  objectId: string
  snapshotId: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  isAccessible: boolean
  referenceTo: string | null
  relationshipType: string | null
  createdAt: string
}

export interface FieldRetrievalResult {
  succeeded: { objectApiName: string; fieldCount: number }[]
  failed: { objectApiName: string; error: string }[]
  totalFields: number
  duration: number
}

export interface FieldsByObjectSummary {
  objectCount: number
  totalFields: number
  inaccessibleFields: number
}

export interface ObjectWithFields {
  objectId: string
  objectApiName: string
  objectLabel: string
  fields: ObjectFieldResult[]
  fieldCount: number
}

export interface FieldsByObjectResult {
  snapshotId: string
  objects: ObjectWithFields[]
  summary: FieldsByObjectSummary
}
