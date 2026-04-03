// 018-rule-description-engine — Row showing one field's migration description

import { Badge } from '@/components/ui/badge'
import type { RuleDescription } from '@/lib/types/rule-description'

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
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-medium text-foreground">{field.sourceField}</span>
            <span className="text-muted-foreground text-xs">→</span>
            <span className="text-sm font-mono font-medium text-foreground">{field.destField}</span>
            <Badge variant={compatibilityVariant(field.typeCompatibility)} className="text-xs">
              {field.typeCompatibility}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{field.migrationDescription}</p>
        </div>
      </div>
    </div>
  )
}
