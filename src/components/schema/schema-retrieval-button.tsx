// 003-source-schema-retrieval — Schema retrieval button component

'use client'

import { Button } from '@/components/ui/button'

interface SchemaRetrievalButtonProps {
  onRetrieve: () => void
  loading: boolean
  hasSnapshot: boolean
}

export function SchemaRetrievalButton({ onRetrieve, loading, hasSnapshot }: SchemaRetrievalButtonProps) {
  return (
    <Button onClick={onRetrieve} disabled={loading}>
      {loading ? 'Retrieving…' : hasSnapshot ? 'Refresh Schema' : 'Retrieve Schema'}
    </Button>
  )
}
