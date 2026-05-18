import { FieldMappingPage as FieldMappingView } from '@/features/field-mapping/components/field-mapping-page'

export default async function FieldMappingPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Field Mapping</h2>
      <FieldMappingView planId={planId} />
    </div>
  )
}
