// 019-text-document — Hook for generating and fetching text documents

'use client'

import { useState, useCallback } from 'react'

export interface TextDocumentStats {
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
}

export interface TextDocumentMeta {
  id: string
  mappingPlanId: string
  generatedAt: string
  stats: TextDocumentStats
}

export interface TextDocumentFull extends TextDocumentMeta {
  htmlContent: string
}

interface UseTextDocumentState {
  meta: TextDocumentMeta | null
  document: TextDocumentFull | null
  loading: boolean
  error: string
}

interface UseTextDocumentReturn extends UseTextDocumentState {
  generate: () => Promise<void>
  fetchDocument: (documentId: string) => Promise<void>
  reset: () => void
}

/**
 * Hook to generate and fetch text documents for a plan.
 *
 * @param planId - The plan ID to generate/fetch documents for.
 */
export function useTextDocument(planId: string): UseTextDocumentReturn {
  const [state, setState] = useState<UseTextDocumentState>({
    meta: null,
    document: null,
    loading: false,
    error: '',
  })

  const generate = useCallback(async () => {
    setState((prev) => ({ ...prev, document: null, loading: true, error: '' }))

    try {
      const res = await fetch(`/api/plans/${planId}/documents/text`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Failed to generate document.' }))
        return
      }

      const meta = data as TextDocumentMeta
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
  setState: React.Dispatch<React.SetStateAction<UseTextDocumentState>>,
) {
  try {
    const res = await fetch(`/api/plans/${planId}/documents/text/${documentId}`)
    const data = await res.json()

    if (!res.ok) {
      setState((prev) => ({ ...prev, loading: false, error: data.error ?? 'Failed to fetch document.' }))
      return
    }

    setState((prev) => ({ ...prev, document: data as TextDocumentFull, loading: false, error: '' }))
  } catch (err) {
    setState((prev) => ({
      ...prev,
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch document.',
    }))
  }
}
