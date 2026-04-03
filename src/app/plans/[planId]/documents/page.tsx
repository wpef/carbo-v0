// 018-rule-description-engine — Documents overview page showing plan description

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { usePlanDescription } from '@/hooks/use-plan-description'
import { PlanDescriptionView } from '@/components/documents/plan-description-view'

export default function DocumentsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { description, loading, error, generate } = usePlanDescription(planId)

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

        <div className="flex gap-2">
          <button
            onClick={() => generate(false)}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Description'}
          </button>
          <button
            onClick={() => generate(true)}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {!description && !loading && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2">No description generated yet.</p>
          <p className="text-sm">
            Click &ldquo;Generate Description&rdquo; to produce a human-readable summary of all migration rules.
          </p>
        </div>
      )}

      {description && <PlanDescriptionView description={description} />}
    </main>
  )
}
