// 013-migration-logic — D4: Informational copy section (no transformation needed)

'use client'

interface InformationalCopySectionProps {
  message: string
}

export function InformationalCopySection({ message }: InformationalCopySectionProps) {
  return (
    <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-5 text-sm text-gray-700">
      <p className="font-semibold mb-1">No transformation needed</p>
      <p>{message}</p>
    </div>
  )
}
