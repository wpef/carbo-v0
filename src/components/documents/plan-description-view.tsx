// 018-rule-description-engine — Renders PlanDescription as a structured readable document

import { ObjectDescriptionCard } from './object-description-card'
import type { PlanDescription } from '@/lib/types/rule-description'

interface PlanDescriptionViewProps {
  description: PlanDescription
}

export function PlanDescriptionView({ description }: PlanDescriptionViewProps) {
  const { planName, objectMappings, generatedAt } = description

  return (
    <div>
      {/* Document header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">{planName}</h1>
        <p className="text-sm text-muted-foreground">
          Migration plan description — generated {new Date(generatedAt).toLocaleString()}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 p-4 rounded-lg bg-muted/40 border text-sm text-muted-foreground">
        This document describes {objectMappings.length} object mapping
        {objectMappings.length !== 1 ? 's' : ''} and all associated field-level migration rules.
        It is intended for client review before the migration is executed.
      </div>

      {/* Object mappings */}
      {objectMappings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No object mappings have been defined yet.</p>
      ) : (
        objectMappings.map((om) => (
          <ObjectDescriptionCard key={om.objectMappingId} objectMapping={om} />
        ))
      )}
    </div>
  )
}
