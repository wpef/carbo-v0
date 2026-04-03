// 003-source-schema-retrieval — Source schema page

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSchema } from '@/hooks/use-schema'
import { ObjectList } from '@/components/schema/object-list'
import { SchemaDiffView } from '@/components/schema/schema-diff'
import { SchemaRetrievalButton } from '@/components/schema/schema-retrieval-button'

export default function SourceSchemaPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const { snapshot, objects, diff, loading, retrieving, error, retrieveSchema } = useSchema(planId, 'source')

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/source`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to source connection
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Source Schema</h1>
          <p className="text-muted-foreground text-sm">
            Retrieve and inspect the objects available in your source system.
          </p>
        </div>
        <SchemaRetrievalButton
          onRetrieve={retrieveSchema}
          loading={retrieving}
          hasSnapshot={snapshot !== null}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive mb-6">{error}</p>
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
          {diff !== undefined && (
            <section>
              <h2 className="text-base font-semibold mb-3">Changes since last retrieval</h2>
              <SchemaDiffView diff={diff} />
            </section>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">No schema retrieved yet.</p>
          <SchemaRetrievalButton
            onRetrieve={retrieveSchema}
            loading={retrieving}
            hasSnapshot={false}
          />
        </div>
      )}
    </main>
  )
}
