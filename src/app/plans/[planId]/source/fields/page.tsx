// 005-source-field-retrieval — Field retrieval step page

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useFields } from '@/hooks/use-fields'
import { FieldRetrievalProgress } from '@/components/fields/FieldRetrievalProgress'
import { ObjectFieldAccordion } from '@/components/fields/ObjectFieldAccordion'
import { Button } from '@/components/ui/button'
import type { FieldRetrievalResult } from '@/lib/types/field'

export default function SourceFieldsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { data, loading, retrieving, lastResult, error, retrieveAndRefresh, fetchFields } = useFields(planId)

  const [progressResult, setProgressResult] = useState<FieldRetrievalResult | undefined>(undefined)

  // Load persisted fields on mount
  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  const handleRetrieve = async () => {
    setProgressResult(undefined)
    const result = await retrieveAndRefresh()
    if (result) {
      setProgressResult(result)
    }
  }

  const hasFields = data && data.objects.length > 0
  const totalObjects = data?.summary.objectCount ?? 0
  const totalFields = data?.summary.totalFields ?? 0

  return (
    <main className="max-w-4xl mx-auto p-8">
      {/* Back navigation */}
      <div className="mb-6">
        <Link href={`/plans/${planId}/source/objects`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to object selection
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Source fields</h1>
          <p className="text-muted-foreground text-sm">
            Retrieve the fields for all selected objects from the source system.
          </p>
        </div>
        <Button
          onClick={handleRetrieve}
          disabled={retrieving}
          className="shrink-0"
        >
          {retrieving ? 'Retrieving...' : hasFields ? 'Re-retrieve fields' : 'Retrieve fields'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive mb-6">{error}</p>
      )}

      {/* Progress indicator (shown during and after retrieval) */}
      {(retrieving || progressResult) && (
        <div className="mb-6">
          <FieldRetrievalProgress
            total={progressResult
              ? progressResult.succeeded.length + progressResult.failed.length
              : totalObjects > 0 ? totalObjects : 1}
            completed={progressResult
              ? progressResult.succeeded.length + progressResult.failed.length
              : retrieving ? 0 : 0}
            result={progressResult}
          />
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <p className="text-sm text-muted-foreground">Loading fields...</p>
      )}

      {/* Empty state — no fields retrieved yet */}
      {!loading && !retrieving && !hasFields && !error && (
        <div className="rounded-lg border border-border py-12 text-center">
          <p className="text-muted-foreground mb-2">No fields retrieved yet.</p>
          <p className="text-sm text-muted-foreground">
            Click <strong>Retrieve fields</strong> to fetch field definitions from the source system.
          </p>
        </div>
      )}

      {/* Summary bar */}
      {hasFields && !loading && (
        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalObjects}</strong> object{totalObjects !== 1 ? 's' : ''}
          </span>
          <span>
            <strong className="text-foreground">{totalFields}</strong> total fields
          </span>
          {data.summary.inaccessibleFields > 0 && (
            <span className="text-destructive">
              {data.summary.inaccessibleFields} inaccessible
            </span>
          )}
        </div>
      )}

      {/* Object accordion */}
      {hasFields && !loading && (
        <ObjectFieldAccordion
          objects={data.objects}
          failedObjects={lastResult?.failed}
        />
      )}

      {/* Workflow navigation */}
      {hasFields && !loading && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium mb-3">Source schema ready.</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/plans/${planId}/destination`}>
              <Button variant="outline" size="sm">
                Connect Destination &rarr;
              </Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
