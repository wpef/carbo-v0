// 008-destination-field-retrieval — Destination fields page

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useFields } from '@/hooks/use-fields'
import { FieldRetrievalProgress } from '@/components/fields/FieldRetrievalProgress'
import { ObjectFieldAccordion } from '@/components/fields/ObjectFieldAccordion'
import { Button } from '@/components/ui/button'
import type { FieldRetrievalResult } from '@/lib/types/field'

export default function DestinationFieldsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { data, loading, retrieving, lastResult, error, retrieveAndRefresh, fetchFields } =
    useFields(planId, 'destination')

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
        <Link
          href={`/plans/${planId}/destination/schema`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to destination schema
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Destination fields</h1>
          <p className="text-muted-foreground text-sm">
            Retrieve field definitions for all destination objects.
          </p>
        </div>
        <Button onClick={handleRetrieve} disabled={retrieving} className="shrink-0">
          {retrieving ? 'Retrieving...' : hasFields ? 'Re-retrieve fields' : 'Retrieve fields'}
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive mb-6">{error}</p>}

      {/* Progress indicator (shown during and after retrieval) */}
      {(retrieving || progressResult) && (
        <div className="mb-6">
          <FieldRetrievalProgress
            total={
              progressResult
                ? progressResult.succeeded.length + progressResult.failed.length
                : totalObjects > 0
                  ? totalObjects
                  : 1
            }
            completed={
              progressResult
                ? progressResult.succeeded.length + progressResult.failed.length
                : retrieving
                  ? 0
                  : 0
            }
            result={progressResult}
          />
        </div>
      )}

      {/* Loading state */}
      {loading && <p className="text-sm text-muted-foreground">Loading fields...</p>}

      {/* Empty state */}
      {!loading && !retrieving && !hasFields && !error && (
        <div className="rounded-lg border border-border py-12 text-center">
          <p className="text-muted-foreground mb-2">No fields retrieved yet.</p>
          <p className="text-sm text-muted-foreground">
            Click <strong>Retrieve fields</strong> to fetch field definitions from the destination
            system.
          </p>
        </div>
      )}

      {/* Summary bar */}
      {hasFields && !loading && (
        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalObjects}</strong> object
            {totalObjects !== 1 ? 's' : ''}
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
        <ObjectFieldAccordion objects={data.objects} failedObjects={lastResult?.failed} />
      )}

      {/* Workflow navigation */}
      {hasFields && !loading && (
        <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium mb-1">
            Destination schema ready ({totalObjects} object{totalObjects !== 1 ? 's' : ''},{' '}
            {totalFields} field{totalFields !== 1 ? 's' : ''}).
          </p>
          <p className="text-sm text-muted-foreground mb-3">Next: Create Mapping</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/plans/${planId}/mapping`}>
              <Button size="sm">Create Mapping &rarr;</Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
