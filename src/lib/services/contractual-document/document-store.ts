// 020-contractual-document — In-memory document store (replaces DB persistence; no schema modification)
// In production this would be a Prisma ContractualDocument model.

import type { GenerationStats, Article } from './types'

export interface StoredContractualDocument {
  id: string
  planId: string
  planName: string
  referenceNumber: string
  generatedAt: string
  stats: GenerationStats
  articles: Article[]
  html: string
}

// Module-level singleton map: planId → documents (newest first)
const store = new Map<string, StoredContractualDocument[]>()

let idCounter = 0

export function storeDocument(doc: Omit<StoredContractualDocument, 'id'>): StoredContractualDocument {
  const id = `cdoc_${Date.now()}_${++idCounter}`
  const entry: StoredContractualDocument = { id, ...doc }
  const existing = store.get(doc.planId) ?? []
  store.set(doc.planId, [entry, ...existing])
  return entry
}

export function listDocuments(planId: string): StoredContractualDocument[] {
  return store.get(planId) ?? []
}

export function getDocument(planId: string, documentId: string): StoredContractualDocument | undefined {
  return (store.get(planId) ?? []).find((d) => d.id === documentId)
}
