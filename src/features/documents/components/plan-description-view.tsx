// 018-rule-description-engine — Renders PlanDescription as a structured readable document (v4)

import { ObjectDescriptionCard } from './object-description-card'
import type { PlanDescription } from '@/features/documents/types/plan-description'

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
          Description du plan de migration — générée le {new Date(generatedAt).toLocaleString('fr-FR')}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 p-4 rounded-lg bg-muted/40 border text-sm text-muted-foreground">
        Ce document décrit {objectMappings.length} correspondance{objectMappings.length !== 1 ? 's' : ''} d&apos;objet
        et toutes les règles de migration au niveau des champs. Il est destiné à la revue client avant l&apos;exécution
        de la migration.
      </div>

      {/* Object mappings */}
      {objectMappings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune correspondance d&apos;objet définie pour le moment.</p>
      ) : (
        objectMappings.map((om) => <ObjectDescriptionCard key={om.objectMappingId} objectMapping={om} />)
      )}
    </div>
  )
}
