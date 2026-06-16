// 022-schema-write — Schema write page (T018)
// Route: /plans/[planId]/schema-write
// Ported from v3 src/app/plans/[planId]/schema-write/page.tsx

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SchemaWritePanel } from '@/features/schema-write/components/schema-write-panel'
import type { ModifyableField } from '@/features/schema-write/components/modify-field-modal'

interface SchemaObject {
  apiName: string
  label: string
  isCustom: boolean
  fields?: ModifyableField[]
}

export default function SchemaWritePage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const [destinationObjects, setDestinationObjects] = useState<SchemaObject[]>([])
  const [destinationFields, setDestinationFields] = useState<ModifyableField[]>([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const fetchDestinationSchema = useCallback(async () => {
    setSchemaLoading(true)
    setSchemaError(null)
    try {
      const schemaRes = await fetch(`/api/plans/${planId}/destination/schema`)
      if (schemaRes.status === 404 || !schemaRes.ok) {
        setDestinationObjects([])
        return
      }
      const schemaData = await schemaRes.json()
      const objects: SchemaObject[] = (schemaData?.objects ?? []).map(
        (o: { apiName: string; label: string; isCustom?: boolean }) => ({
          apiName: o.apiName,
          label: o.label,
          isCustom: o.isCustom ?? false,
        }),
      )
      setDestinationObjects(objects)

      // Fetch fields (optional — if no snapshot yet, empty is fine)
      const fieldsRes = await fetch(`/api/plans/${planId}/destination/fields`)
      if (fieldsRes.ok) {
        const fieldsData = await fieldsRes.json() as Record<string, Array<{
          apiName: string
          label: string
          dataType: string
          picklistValues?: string | null
        }>>
        const allFields: ModifyableField[] = Object.values(fieldsData).flatMap((group) =>
          group.map((f) => ({
            apiName: f.apiName,
            label: f.label,
            dataType: f.dataType,
            picklistValues: f.picklistValues ? (JSON.parse(f.picklistValues) as string[]) : undefined,
          })),
        )
        setDestinationFields(allFields)
      }
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : 'Failed to load destination schema.')
    } finally {
      setSchemaLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchDestinationSchema()
  }, [fetchDestinationSchema])

  return (
    <main className="max-w-3xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Retour au plan
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Écriture de schéma</h1>
        <p className="text-muted-foreground mt-1">
          Ajoutez des objets et des champs personnalisés au système de destination avant d&apos;exécuter la migration.
        </p>
      </div>

      {schemaLoading ? (
        <p className="text-sm text-muted-foreground">Chargement du schéma de destination…</p>
      ) : (
        <>
          {schemaError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {schemaError}
            </div>
          )}
          <SchemaWritePanel
            planId={planId}
            destinationObjects={destinationObjects.map(({ apiName, label }) => ({ apiName, label }))}
            destinationFields={destinationFields}
            onSchemaChanged={fetchDestinationSchema}
          />
        </>
      )}
    </main>
  )
}
