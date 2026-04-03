// 009-record-preview — Destination record preview page

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { RecordPreview } from '@/components/records/record-preview'

export default function DestinationRecordPreviewPage() {
  const params = useParams<{ planId: string; objectApiName: string }>()
  const { planId, objectApiName } = params

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-6">
        <Link
          href={`/plans/${planId}/destination`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to destination
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">
          Records — <span className="font-mono text-lg">{objectApiName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Browsing destination records for object <span className="font-mono">{objectApiName}</span>.
        </p>
      </div>

      <RecordPreview planId={planId} role="destination" objectApiName={objectApiName} />
    </main>
  )
}
