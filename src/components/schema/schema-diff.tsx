// 003-source-schema-retrieval — Schema diff component

import type { SchemaDiff } from '@/lib/types/schema'

interface SchemaDiffProps {
  diff: SchemaDiff | null
}

export function SchemaDiffView({ diff }: SchemaDiffProps) {
  if (diff === null) {
    return (
      <p className="text-sm text-muted-foreground italic">
        First retrieval — no previous schema to compare.
      </p>
    )
  }

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0

  if (!hasChanges) {
    return (
      <p className="text-sm text-muted-foreground">
        No changes since last retrieval. {diff.unchanged.length} object(s) unchanged.
      </p>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      {diff.added.length > 0 && (
        <div>
          <p className="font-medium text-green-600 mb-1">Added ({diff.added.length})</p>
          <ul className="space-y-0.5">
            {diff.added.map((name) => (
              <li key={name} className="font-mono text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                + {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.removed.length > 0 && (
        <div>
          <p className="font-medium text-red-600 mb-1">Removed ({diff.removed.length})</p>
          <ul className="space-y-0.5">
            {diff.removed.map((name) => (
              <li key={name} className="font-mono text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">
                - {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.modified.length > 0 && (
        <div>
          <p className="font-medium text-yellow-600 mb-1">Modified ({diff.modified.length})</p>
          <ul className="space-y-0.5">
            {diff.modified.map((name) => (
              <li key={name} className="font-mono text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">
                ~ {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.unchanged.length > 0 && (
        <p className="text-muted-foreground text-xs">{diff.unchanged.length} object(s) unchanged.</p>
      )}
    </div>
  )
}
