// 003-source-schema-retrieval — Schema diff types

export interface SchemaDiff {
  added: string[]
  removed: string[]
  modified: string[]
  unchanged: string[]
}
