// 020-contractual-document — Contractual document generation page

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useContractualDocument } from '@/hooks/use-contractual-document'
import { ContractualDocumentView } from '@/components/documents/contractual-document-view'

export default function ContractualDocumentPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { document, loading, error, generate } = useContractualDocument(planId)

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/documents`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Documents
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1 font-serif">Contractual Document</h1>
          <p className="text-muted-foreground text-sm">
            Generate a formal contractual migration specification with signature blocks for client sign-off.
          </p>
        </div>

        <button
          onClick={() => generate()}
          disabled={loading}
          className="inline-flex items-center rounded-lg border-2 border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Contractual Document'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {!document && !loading && !error && (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-lg mb-2 font-serif">No contractual document generated yet.</p>
          <p className="text-sm">
            Click &ldquo;Generate Contractual Document&rdquo; to produce a formal specification with
            article-by-article structure and signature blocks.
          </p>
        </div>
      )}

      {loading && (
        <div className="py-16 text-center text-muted-foreground">
          <p>Generating contractual document&hellip;</p>
          <p className="text-sm mt-2">Building scope, correspondence tables, rules, exclusions, and signature blocks.</p>
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
