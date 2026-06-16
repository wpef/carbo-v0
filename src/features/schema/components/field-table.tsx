// 005-source-field-retrieval — Table of fields for one object

import { FieldRow } from './field-row'
import type { ObjectFieldResult } from '@/features/schema/hooks/use-fields'

interface FieldTableProps {
  fields: ObjectFieldResult[]
}

export function FieldTable({ fields }: FieldTableProps) {
  if (fields.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No fields found.</div>
    )
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-2 px-3 text-left font-medium text-muted-foreground">Field</th>
            <th className="py-2 px-3 text-left font-medium text-muted-foreground">Type</th>
            <th className="py-2 px-3 text-left font-medium text-muted-foreground">Constraints</th>
            <th className="py-2 px-3 text-left font-medium text-muted-foreground">Relationship</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <FieldRow key={field.id} field={field} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
