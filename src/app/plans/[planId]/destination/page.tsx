import { DestinationConnectionPage } from '@/features/destination-connection/components/destination-connection-page'

export default async function DestinationPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Destination Connection</h2>
      <DestinationConnectionPage planId={planId} />
    </div>
  )
}
