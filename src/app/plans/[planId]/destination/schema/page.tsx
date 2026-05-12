// 007-destination-schema-retrieval — Destination schema page
// Refresh button uses the full setup chain (007 FR-004) to guarantee that
// schema → fields → integrity check all run together. The dedicated
// /destination/schema page must never produce a snapshot of objects without fields.

'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSchema } from '@/hooks/use-schema'
import { useConnectionSetup } from '@/hooks/use-connection-setup'
import { ObjectList } from '@/components/schema/object-list'
import { SchemaDiffView } from '@/components/schema/schema-diff'
import { SchemaRetrievalButton } from '@/components/schema/schema-retrieval-button'
import { SetupProgress } from '@/components/connection/SetupProgress'

interface DestinationConnection {
  id: string
  adapterType: string
  status: string
}

export default function DestinationSchemaPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { snapshot, objects, diff, loading, error, refetch } = useSchema(planId, 'destination')
  const setup = useConnectionSetup(planId, 'destination')

  // Inline-fetch the destination connection to discover the adapter type
  // (there's no dedicated hook; the /destination page also fetches inline).
  const [connection, setConnection] = useState<DestinationConnection | null>(null)
  const [connLoading, setConnLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/plans/${planId}/destination-connection`)
      .then((res) => res.json())
      .then((data) => setConnection(data.connection ?? null))
      .catch(() => {})
      .finally(() => setConnLoading(false))
  }, [planId])

  // After the setup chain completes, re-fetch the snapshot so the display
  // reflects the freshly retrieved schema.
  const lastCompletePhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (setup.phase === 'COMPLETE' && lastCompletePhaseRef.current !== 'COMPLETE') {
      lastCompletePhaseRef.current = 'COMPLETE'
      refetch()
    }
    if (setup.phase !== 'COMPLETE') {
      lastCompletePhaseRef.current = setup.phase
    }
  }, [setup.phase, refetch])

  const handleRefresh = () => {
    if (!connection?.adapterType) return
    setup.startSetup(connection.adapterType, {}, { skipConnect: true })
  }

  const refreshing = setup.phase !== 'IDLE' && setup.phase !== 'COMPLETE' && setup.phase !== 'ERROR'

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/destination`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to destination connection
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Destination Schema</h1>
          <p className="text-muted-foreground text-sm">
            Retrieve and inspect the objects available in your destination system.
          </p>
        </div>
        <SchemaRetrievalButton
          onRetrieve={handleRefresh}
          loading={refreshing || connLoading}
          hasSnapshot={snapshot !== null}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive mb-6">{error}</p>
      )}

      {/* Live progress while the full chain runs (schema → fields → integrity) */}
      {setup.phase !== 'IDLE' && (
        <div className="mb-6">
          <SetupProgress
            phase={setup.phase}
            error={setup.error}
            role="destination"
            results={setup.results}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading schema...</p>
      ) : snapshot ? (
        <div className="space-y-8">
          {/* Snapshot metadata */}
          <section>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>{snapshot.objectCount} object(s)</span>
              <span>&middot;</span>
              <span>Retrieved {new Date(snapshot.retrievedAt).toLocaleString()}</span>
            </div>
          </section>

          {/* Object list */}
          <section>
            <h2 className="text-base font-semibold mb-3">Objects</h2>
            <ObjectList objects={objects} />
          </section>

          {/* Diff (only shown after a refresh) */}
          {diff !== undefined && diff !== null && (
            <section>
              <h2 className="text-base font-semibold mb-3">Changes since last retrieval</h2>
              <SchemaDiffView diff={diff} />
            </section>
          )}

          {/* Workflow navigation */}
          <section className="border-t pt-6">
            <p className="text-sm text-muted-foreground mb-3">
              Schema retrieved ({snapshot.objectCount} object(s)). Next step:
            </p>
            <Link
              href={`/plans/${planId}/destination/fields`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View Fields &rarr;
            </Link>
          </section>
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">No schema retrieved yet.</p>
          <SchemaRetrievalButton
            onRetrieve={handleRefresh}
            loading={refreshing || connLoading}
            hasSnapshot={false}
          />
        </div>
      )}
    </main>
  )
}
