// 019-text-document — Preview page for a generated text document

'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTextDocument } from '@/hooks/use-text-document'
import { TextDocumentPreview } from '@/components/documents/text-document-preview'
import { PdfDownloadButton } from '@/components/documents/pdf-download-button'

export default function TextDocumentPage() {
  const params = useParams<{ planId: string; documentId: string }>()
  const { planId, documentId } = params

  const { document, loading, error, fetchDocument } = useTextDocument(planId)

  useEffect(() => {
    fetchDocument(documentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/documents`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Documents
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Text Document Preview</h1>
          <p className="text-muted-foreground text-sm">
            Human-readable migration plan document for client review.
          </p>
        </div>
        <PdfDownloadButton planId={planId} documentId={documentId} documentType="text" />
      </div>

      {loading && (
        <div className="py-16 text-center text-muted-foreground">
          <p>Loading document...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {document && !loading && (
        <TextDocumentPreview
          htmlContent={document.htmlContent}
          stats={document.stats}
          generatedAt={document.generatedAt}
        />
      )}
    </main>
  )
}
