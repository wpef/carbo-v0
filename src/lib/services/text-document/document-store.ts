// 019-text-document — In-memory document store (replaces DB persistence; no schema modification)
// In production this would be a Prisma TextDocument model.

import type { GenerationStats } from './types'

export interface StoredTextDocument {
  id: string
  planId: string
  planName: string
  generatedAt: string
  stats: GenerationStats
  html: string
}

// Module-level singleton map: planId → documents (newest first)
const store = new Map<string, StoredTextDocument[]>()

let idCounter = 0

export function storeDocument(doc: Omit<StoredTextDocument, 'id'>): StoredTextDocument {
  const id = `tdoc_${Date.now()}_${++idCounter}`
  const entry: StoredTextDocument = { id, ...doc }
  const existing = store.get(doc.planId) ?? []
  store.set(doc.planId, [entry, ...existing])
  return entry
}

export function listDocuments(planId: string): StoredTextDocument[] {
  return store.get(planId) ?? []
}

export function getDocument(planId: string, documentId: string): StoredTextDocument | undefined {
  return (store.get(planId) ?? []).find((d) => d.id === documentId)
}
