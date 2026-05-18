import { ObjectMappingPage as ObjectMappingView } from '@/features/object-mapping/components/object-mapping-page'

export default async function ObjectMappingPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Object Mapping</h2>
      <ObjectMappingView planId={planId} />
    </div>
  )
}
