// 003-source-schema-retrieval — Object list component

import { Badge } from '@/components/ui/badge'

interface SchemaObjectItem {
  apiName: string
  label: string
  isCustom: boolean
  description?: string | null
}

interface ObjectListProps {
  objects: SchemaObjectItem[]
}

export function ObjectList({ objects }: ObjectListProps) {
  if (objects.length === 0) {
    return <p className="text-sm text-muted-foreground">No objects found in this schema.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">API Name</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Label</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((obj, idx) => (
            <tr key={obj.apiName} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
              <td className="px-4 py-2 font-mono text-xs">{obj.apiName}</td>
              <td className="px-4 py-2">{obj.label}</td>
              <td className="px-4 py-2 text-muted-foreground">{obj.description ?? '—'}</td>
              <td className="px-4 py-2">
                {obj.isCustom ? (
                  <Badge variant="secondary">Custom</Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Standard</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
