import { DocumentsPage as DocumentsView } from '@/features/documents/components/documents-page'

export default async function DocumentsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Documents</h2>
      <DocumentsView planId={planId} />
    </div>
  )
}
