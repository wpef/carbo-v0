// 004-source-object-selection — Object selection page

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useObjectSelection } from '@/hooks/use-object-selection'
import { ObjectSelectionList } from '@/components/objects/object-selection-list'

export default function SourceObjectsPage() {
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const {
    objects,
    summary,
    loading,
    saving,
    error,
    includeSystem,
    toggleSelect,
    selectAll,
    deselectAll,
    toggleSystem,
  } = useObjectSelection(planId)

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="mb-6">
        <Link href={`/plans/${planId}/source/schema`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to source schema
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Select source objects</h1>
        <p className="text-muted-foreground text-sm">
          Choose which objects to include in the migration plan. Custom and common business objects
          are pre-selected.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-6">{error}</p>
      )}

      {saving && (
        <p className="text-sm text-muted-foreground mb-4">Saving...</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading objects...</p>
      ) : objects.length === 0 && !error ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-2">No schema snapshot found.</p>
          <p className="text-sm text-muted-foreground">
            <Link href={`/plans/${planId}/source/schema`} className="underline hover:text-foreground">
              Retrieve the source schema
            </Link>{' '}
            first, then come back to select objects.
          </p>
        </div>
      ) : (
        <ObjectSelectionList
          planId={planId}
          objects={objects}
          summary={summary}
          includeSystem={includeSystem}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onToggleSystem={toggleSystem}
        />
      )}
    </main>
  )
}
