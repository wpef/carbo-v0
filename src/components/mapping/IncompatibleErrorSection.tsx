// 013-migration-logic — D3: Incompatible types error section

'use client'

export function IncompatibleErrorSection() {
  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold mb-2">These field types cannot be linked directly.</p>
      <p>
        Unfortunately, we cannot currently link these two field types. We will send you a CSV by email
        containing the destination IDs and source values for this field so you can update it after migration.
      </p>
    </div>
  )
}
