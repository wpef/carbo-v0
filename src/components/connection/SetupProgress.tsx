'use client'

import type { SetupPhase } from '@/hooks/use-connection-setup'

interface SetupProgressProps {
  phase: SetupPhase
  error: string | null
  role: 'source' | 'destination'
  results: {
    objectCount: number | null
    selectedCount: number | null
    totalCount: number | null
    fieldCount: number | null
  }
}

const SOURCE_STEPS = [
  { phase: 'CONNECTING' as const, label: 'Connecting' },
  { phase: 'RETRIEVING_SCHEMA' as const, label: 'Retrieving schema' },
  { phase: 'SELECTING_OBJECTS' as const, label: 'Selecting objects' },
  { phase: 'RETRIEVING_FIELDS' as const, label: 'Retrieving fields' },
]

const DEST_STEPS = [
  { phase: 'CONNECTING' as const, label: 'Connecting' },
  { phase: 'RETRIEVING_SCHEMA' as const, label: 'Retrieving schema' },
  { phase: 'RETRIEVING_FIELDS' as const, label: 'Retrieving fields' },
]

const PHASE_ORDER: SetupPhase[] = [
  'CONNECTING',
  'RETRIEVING_SCHEMA',
  'SELECTING_OBJECTS',
  'RETRIEVING_FIELDS',
  'COMPLETE',
]

function getDetail(phase: SetupPhase, results: SetupProgressProps['results']): string | null {
  switch (phase) {
    case 'RETRIEVING_SCHEMA':
      return results.objectCount !== null ? `${results.objectCount} objects` : null
    case 'SELECTING_OBJECTS':
      return results.selectedCount !== null && results.totalCount !== null
        ? `${results.selectedCount}/${results.totalCount} selected`
        : null
    case 'RETRIEVING_FIELDS':
      return results.fieldCount !== null ? `${results.fieldCount} fields` : null
    default:
      return null
  }
}

export function SetupProgress({ phase, error, role, results }: SetupProgressProps) {
  if (phase === 'IDLE') return null

  const steps = role === 'source' ? SOURCE_STEPS : DEST_STEPS
  const currentIndex = PHASE_ORDER.indexOf(phase)

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
      <h3 className="text-sm font-medium mb-3">Setup Progress</h3>
      {steps.map((step) => {
        const stepIndex = PHASE_ORDER.indexOf(step.phase)
        const isDone = phase === 'COMPLETE' || currentIndex > stepIndex
        const isCurrent = phase === step.phase
        const detail = isDone ? getDetail(step.phase, results) : null

        return (
          <div key={step.phase} className="flex items-center gap-3 text-sm">
            <span className="w-5 text-center">
              {isDone ? (
                <span className="text-green-600">&#10003;</span>
              ) : isCurrent ? (
                <span className="animate-spin inline-block">&#9697;</span>
              ) : (
                <span className="text-muted-foreground">&#9675;</span>
              )}
            </span>
            <span className={isDone ? 'text-foreground' : isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {step.label}
            </span>
            {detail && <span className="text-muted-foreground text-xs">({detail})</span>}
          </div>
        )
      })}

      {phase === 'ERROR' && error && (
        <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {phase === 'COMPLETE' && (
        <div className="mt-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Setup complete. Ready to proceed.
        </div>
      )}
    </div>
  )
}
