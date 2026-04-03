// 019-text-document — Generic document section renderer

'use client'

export type SectionType = 'title' | 'summary' | 'object-mapping' | 'warnings' | 'statistics'

export interface DocumentSection {
  type: SectionType
  title: string
  content: string // HTML content
}

interface DocumentSectionProps {
  section: DocumentSection
}

/**
 * Renders a single section of the text document using dangerouslySetInnerHTML.
 * The HTML content comes from the server-side template builder and is trusted.
 */
export function DocumentSectionView({ section }: DocumentSectionProps) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3 pb-2 border-b">{section.title}</h2>
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: section.content }} />
    </div>
  )
}
