// 022-schema-write — Schema write page

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SchemaWritePanel } from '@/components/schema-write/schema-write-panel'

interface SchemaObject {
  apiName: string
  label: string
  isCustom: boolean
}

export default function SchemaWritePage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const [destinationObjects, setDestinationObjects] = useState<SchemaObject[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const fetchDestinationObjects = useCallback(async () => {
    setSchemaLoading(true)
    setSchemaError(null)
    try {
      const res = await fetch(`/api/plans/${planId}/destination-schema`)
      if (res.status === 404) {
        // No snapshot yet — empty list is fine
        setDestinationObjects([])
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setDestinationObjects(data.objects ?? [])
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : 'Failed to load destination schema.')
    } finally {
      setSchemaLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchDestinationObjects()
  }, [fetchDestinationObjects])

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Schema Write</h1>
        <p className="text-muted-foreground mt-1">
          Add custom objects and fields to the destination system before executing the migration.
        </p>
      </div>

      {schemaLoading ? (
        <p className="text-sm text-muted-foreground">Loading destination schema...</p>
      ) : (
        <>
          {schemaError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {schemaError}
            </div>
          )}

          <SchemaWritePanel
            planId={planId}
            destinationObjects={destinationObjects}
            onSchemaChanged={fetchDestinationObjects}
          />
        </>
      )}
    </main>
  )
}
