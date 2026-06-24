// 018-rule-description-engine — Card showing one object mapping's description (v4)

import { FieldDescriptionRow } from './field-description-row'
import type { ObjectMappingDescription } from '@/features/documents/types/plan-description'

interface ObjectDescriptionCardProps {
  objectMapping: ObjectMappingDescription
}

export function ObjectDescriptionCard({ objectMapping }: ObjectDescriptionCardProps) {
  const { sourceObject, destObject, fieldDescriptions, filterSummary, unmappedSourceCount, unmappedDestCount } =
    objectMapping

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-base">{sourceObject}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-semibold text-base">{destObject}</span>
        </div>
        {/* Filter summary */}
        <p className="text-sm text-muted-foreground mt-1">{filterSummary}</p>
        {/* Unmapped counts */}
        {(unmappedSourceCount > 0 || unmappedDestCount > 0) && (
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            {unmappedSourceCount > 0 && (
              <span className="text-amber-600">
                {unmappedSourceCount} champ{unmappedSourceCount !== 1 ? 's' : ''} source non-mappé
                {unmappedSourceCount !== 1 ? 's' : ''}
              </span>
            )}
            {unmappedDestCount > 0 && (
              <span className="text-amber-600">
                {unmappedDestCount} champ{unmappedDestCount !== 1 ? 's' : ''} destination non-mappé
                {unmappedDestCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Field descriptions */}
      <div className="px-6">
        {fieldDescriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucun mapping de champ défini pour cet objet.</p>
        ) : (
          fieldDescriptions.map((field) => (
            <FieldDescriptionRow key={field.fieldMappingId} field={field} />
          ))
        )}
      </div>
    </div>
  )
}
