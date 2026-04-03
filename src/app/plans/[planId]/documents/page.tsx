// 018-rule-description-engine + 019-text-document — Documents overview page

'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePlanDescription } from '@/hooks/use-plan-description'
import { useTextDocument } from '@/hooks/use-text-document'
import { PlanDescriptionView } from '@/components/documents/plan-description-view'

export default function DocumentsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId
  const router = useRouter()

  const { description, loading: descLoading, error: descError, generate } = usePlanDescription(planId)
  const { meta, loading: textLoading, error: textError, generate: generateText } = useTextDocument(planId)

  const loading = descLoading || textLoading

  async function handleGenerateText() {
    await generateText()
  }

  // Navigate to preview page when a text document is generated
  if (meta) {
    router.push(`/plans/${planId}/documents/text/${meta.id}`)
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Documents</h1>
          <p className="text-muted-foreground text-sm">
            Generate a human-readable description of all migration rules for client review.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => generate(false)}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {descLoading ? 'Generating...' : 'Generate Description'}
          </button>
          <button
            onClick={() => generate(true)}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {descLoading ? 'Generating...' : 'Generate with AI'}
          </button>
          <button
            onClick={handleGenerateText}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {textLoading ? 'Generating...' : 'Generate Text Document'}
          </button>
        </div>
      </div>

      {(descError || textError) && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {descError || textError}
        </div>
      )}

      {!description && !loading && !descError && !textError && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No description generated yet.</p>
          <p className="text-sm">
            Click &ldquo;Generate Description&rdquo; to produce a human-readable summary of all migration rules,
            or &ldquo;Generate Text Document&rdquo; to create a printable client document.
          </p>
        </div>
      )}

      {description && <PlanDescriptionView description={description} />}
    </main>
  )
}
