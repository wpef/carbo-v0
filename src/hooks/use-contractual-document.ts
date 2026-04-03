// 020-contractual-document — Hook for generating and fetching contractual documents

'use client'

import { useState, useCallback } from 'react'
import type { Article } from '@/lib/services/contractual-document/types'

export interface ContractualDocumentStats {
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
}

export interface ContractualDocumentMeta {
  id: string
  referenceNumber: string
  mappingPlanId: string
  generatedAt: string
  stats: ContractualDocumentStats
}

export interface ContractualDocumentFull extends ContractualDocumentMeta {
  planName: string
  articles: Article[]
  htmlContent: string
}

interface UseContractualDocumentState {
  meta: ContractualDocumentMeta | null
  document: ContractualDocumentFull | null
  loading: boolean
  error: string
}

interface UseContractualDocumentReturn extends UseContractualDocumentState {
  generate: () => Promise<void>
  fetchDocument: (documentId: string) => Promise<void>
  reset: () => void
}

/**
 * Hook to generate and fetch contractual documents for a plan.
 *
 * @param planId - The plan ID to generate/fetch documents for.
 */
export function useContractualDocument(planId: string): UseContractualDocumentReturn {
  const [state, setState] = useState<UseContractualDocumentState>({
    meta: null,
    document: null,
    loading: false,
    error: '',
  })

  const generate = useCallback(async () => {
    setState((prev) => ({ ...prev, document: null, loading: true, error: '' }))

    try {
      const res = await fetch(`/api/plans/${planId}/documents/contractual`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Failed to generate document.' }))
        return
      }

      const meta = data as ContractualDocumentMeta
      setState((prev) => ({ ...prev, meta, loading: false, error: '' }))

      // Immediately fetch the full document content
      await fetchDocumentById(planId, meta.id, setState)
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to generate document.',
      }))
    }
  }, [planId])

  const fetchDocument = useCallback(
    async (documentId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: '' }))
      await fetchDocumentById(planId, documentId, setState)
    },
    [planId],
  )

  const reset = useCallback(() => {
    setState({ meta: null, document: null, loading: false, error: '' })
  }, [])

  return {
    meta: state.meta,
    document: state.document,
    loading: state.loading,
    error: state.error,
    generate,
    fetchDocument,
    reset,
  }
}

// ---------------------------------------------------------------------------
// Shared fetch helper (outside of render cycle)
// ---------------------------------------------------------------------------

async function fetchDocumentById(
  planId: string,
  documentId: string,
  setState: React.Dispatch<React.SetStateAction<UseContractualDocumentState>>,
) {
  try {
    const res = await fetch(`/api/plans/${planId}/documents/contractual/${documentId}`)
    const data = await res.json()

    if (!res.ok) {
      setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Failed to fetch document.' }))
      return
    }

    setState((prev) => ({ ...prev, document: data as ContractualDocumentFull, loading: false, error: '' }))
  } catch (err) {
    setState((prev) => ({
      ...prev,
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch document.',
    }))
  }
}
