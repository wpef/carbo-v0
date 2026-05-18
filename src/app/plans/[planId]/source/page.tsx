import { SourceConnectionPage } from '@/features/source-connection/components/source-connection-page'

export default async function SourcePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Source Connection</h2>
      <SourceConnectionPage planId={planId} />
    </div>
  )
}
