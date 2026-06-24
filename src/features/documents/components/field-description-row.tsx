// 018-rule-description-engine — Row showing one field's migration description (v4)

import { Badge } from '@/components/ui/badge'
import type { RuleDescription } from '@/features/documents/types/plan-description'

interface FieldDescriptionRowProps {
  field: RuleDescription
}

function compatibilityVariant(tc: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (tc) {
    case 'INCOMPATIBLE':
      return 'destructive'
    case 'WARNING':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function FieldDescriptionRow({ field }: FieldDescriptionRowProps) {
  return (
    <div className="py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-mono font-medium text-foreground">{field.sourceField}</span>
            <span className="text-muted-foreground text-xs">→</span>
            <span className="text-sm font-mono font-medium text-foreground">{field.destField}</span>
            <Badge variant={compatibilityVariant(field.typeCompatibility)} className="text-xs">
              {field.typeCompatibility}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {field.migrationDescription}
          </p>
          {field.filterDescriptions.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {field.filterDescriptions.map((desc, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {desc}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
