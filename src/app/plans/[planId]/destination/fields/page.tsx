// 008-destination-field-retrieval — Destination fields page (Cluster 15)

'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordStep } from '@/features/plans/lib/record-step'
import { useFields } from '@/features/schema/hooks/use-fields'
import { FieldRetrievalProgress } from '@/features/schema/components/field-retrieval-progress'
import { ObjectFieldAccordion } from '@/features/schema/components/object-field-accordion'
import type { FieldRetrievalItemResult } from '@/features/schema/hooks/use-fields'

export default function DestinationFieldsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId
  const router = useRouter()

  const { data, loading, retrieving, lastResults, error, retrieveAndRefresh, fetchFields } =
    useFields(planId, 'destination')

  const [progressResults, setProgressResults] = useState<FieldRetrievalItemResult[] | undefined>(undefined)

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  // Auto-retrieve on first arrival if nothing has been retrieved yet — no manual "Retrieve"
  // click needed (refresh strategy: auto on first reach; the button re-retrieves on demand).
  const autoRetrievedRef = useRef(false)
  useEffect(() => {
    if (!autoRetrievedRef.current && !loading && !retrieving && !error && data && data.objects.length === 0) {
      autoRetrievedRef.current = true
      retrieveAndRefresh()
    }
  }, [loading, retrieving, error, data, retrieveAndRefresh])

  const handleRetrieve = async () => {
    setProgressResults(undefined)
    const results = await retrieveAndRefresh()
    if (results) setProgressResults(results)
  }

  const hasFields = data && data.objects.length > 0
  const totalObjects = data?.summary.objectCount ?? 0
  const totalFields = data?.summary.totalFields ?? 0

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/destination`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to destination
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Destination fields</h1>
          <p className="text-muted-foreground text-sm">
            Retrieve field definitions for all destination objects.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetrieve}
          disabled={retrieving}
          className="shrink-0 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {retrieving ? 'Retrieving...' : hasFields ? 'Re-retrieve fields' : 'Retrieve fields'}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-6">{error}</p>}

      {(retrieving || progressResults) && (
        <div className="mb-6">
          <FieldRetrievalProgress
            total={
              progressResults
                ? progressResults.length
                : totalObjects > 0
                  ? totalObjects
                  : 1
            }
            completed={
              progressResults
                ? progressResults.length
                : retrieving
                  ? 0
                  : 0
            }
            results={progressResults}
          />
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading fields...</p>}

      {!loading && !retrieving && !hasFields && !error && (
        <div className="rounded-lg border border-border py-12 text-center">
          <p className="text-muted-foreground mb-2">No fields retrieved yet.</p>
          <p className="text-sm text-muted-foreground">
            Click <strong>Retrieve fields</strong> to fetch field definitions from the destination
            system.
          </p>
        </div>
      )}

      {hasFields && !loading && (
        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalObjects}</strong> object{totalObjects !== 1 ? 's' : ''}
          </span>
          <span>
            <strong className="text-foreground">{totalFields}</strong> total fields
          </span>
          {data.summary.inaccessibleFields > 0 && (
            <span className="text-destructive">{data.summary.inaccessibleFields} inaccessible</span>
          )}
        </div>
      )}

      {hasFields && !loading && (
        <ObjectFieldAccordion
          objects={data.objects}
          failedObjects={lastResults?.filter((r) => !!r.error)}
          planId={planId}
          side="destination"
        />
      )}

      {hasFields && !loading && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium mb-1">
            Destination schema ready ({totalObjects} object{totalObjects !== 1 ? 's' : ''},{' '}
            {totalFields} field{totalFields !== 1 ? 's' : ''}).
          </p>
          <p className="text-sm text-muted-foreground mb-3">Next: Create Mapping</p>
          <button
            type="button"
            onClick={async () => {
              await recordStep(planId, 'OBJECT_MAPPING')
              router.push(`/plans/${planId}/object-mapping`)
            }}
            className="px-3 py-1.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Mapping &rarr;
          </button>
        </div>
      )}
    </main>
  )
}
