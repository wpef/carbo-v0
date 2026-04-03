// 020-contractual-document — Preview page for a specific contractual document version

'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useContractualDocument } from '@/hooks/use-contractual-document'
import { ContractualDocumentView } from '@/components/documents/contractual-document-view'

export default function ContractualDocumentDetailPage() {
  const params = useParams<{ planId: string; documentId: string }>()
  const { planId, documentId } = params

  const { document, loading, error, fetchDocument } = useContractualDocument(planId)

  useEffect(() => {
    fetchDocument(documentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href={`/plans/${planId}/documents/contractual`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Contractual Documents
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 font-serif">Contractual Document Preview</h1>
        <p className="text-muted-foreground text-sm">
          Formal migration specification for client sign-off. This document is immutable.
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center text-muted-foreground">
          <p>Loading document&hellip;</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {document && !loading && (
        <ContractualDocumentView
          htmlContent={document.htmlContent}
          referenceNumber={document.referenceNumber}
          stats={document.stats}
          generatedAt={document.generatedAt}
        />
      )}
    </main>
  )
}
