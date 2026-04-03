// 020-contractual-document — Signature block component for formal sign-off

interface SignatureBlockProps {
  role: 'Consultant' | 'Client'
  name?: string
  showApprovalCheckbox?: boolean
}

/**
 * A formal signature block for the contractual document view.
 * Displays name, date, and signature fields.
 */
export function SignatureBlock({ role, name, showApprovalCheckbox = false }: SignatureBlockProps) {
  return (
    <div className="border border-gray-300 p-5 bg-white">
      <h3 className="text-xs font-bold uppercase tracking-widest text-center border-b border-gray-200 pb-3 mb-4">
        {role}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Name</label>
          <div className="border-b border-gray-500 h-7 flex items-end pb-1">
            {name ? <span className="text-sm">{name}</span> : null}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Date</label>
          <div className="border-b border-gray-500 h-7" />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Signature</label>
          <div className="border-b border-gray-500 h-10" />
        </div>

        {showApprovalCheckbox && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Approval</label>
            <div className="border-b border-gray-500 h-7 flex items-end pb-1">
              <span className="text-sm text-gray-400">&#9744; I hereby approve this migration specification</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
