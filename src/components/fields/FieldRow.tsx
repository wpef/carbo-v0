// 005-source-field-retrieval — Single field row

import { Badge } from '@/components/ui/badge'
import type { ObjectFieldResult } from '@/lib/types/field'

const DATA_TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-50 text-blue-700 border-blue-200',
  email: 'bg-blue-50 text-blue-700 border-blue-200',
  phone: 'bg-blue-50 text-blue-700 border-blue-200',
  url: 'bg-blue-50 text-blue-700 border-blue-200',
  integer: 'bg-purple-50 text-purple-700 border-purple-200',
  number: 'bg-purple-50 text-purple-700 border-purple-200',
  currency: 'bg-purple-50 text-purple-700 border-purple-200',
  boolean: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  date: 'bg-green-50 text-green-700 border-green-200',
  datetime: 'bg-green-50 text-green-700 border-green-200',
  picklist: 'bg-orange-50 text-orange-700 border-orange-200',
  reference: 'bg-pink-50 text-pink-700 border-pink-200',
}

function DataTypeBadge({ dataType }: { dataType: string }) {
  const colorClass = DATA_TYPE_COLORS[dataType] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono border ${colorClass}`}
    >
      {dataType}
    </span>
  )
}

interface FieldRowProps {
  field: ObjectFieldResult
}

export function FieldRow({ field }: FieldRowProps) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* Field name + label */}
      <td className="py-2 px-3">
        <div className="font-mono text-sm text-foreground">{field.apiName}</div>
        {field.label !== field.apiName && (
          <div className="text-xs text-muted-foreground">{field.label}</div>
        )}
        {!field.isAccessible && (
          <Badge variant="destructive" className="mt-0.5 text-xs">No Access</Badge>
        )}
      </td>

      {/* Data type */}
      <td className="py-2 px-3">
        <DataTypeBadge dataType={field.dataType} />
      </td>

      {/* Constraints */}
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {field.isRequired && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200">
              Required
            </span>
          )}
          {field.isReadOnly && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground border border-border">
              Read-only
            </span>
          )}
          {field.isUnique && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
              Unique
            </span>
          )}
          {!field.isRequired && !field.isReadOnly && !field.isUnique && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>

      {/* Relationship */}
      <td className="py-2 px-3">
        {field.referenceTo ? (
          <div className="text-xs">
            <span className="font-mono text-foreground">{field.referenceTo}</span>
            {field.relationshipType && (
              <span className="ml-1 text-muted-foreground">({field.relationshipType})</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
