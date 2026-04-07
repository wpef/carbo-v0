// 013-migration-logic — D3: Incompatible types error section

'use client'

export function IncompatibleErrorSection() {
  return (
    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold mb-2">Ces types de champs ne peuvent pas être liés directement.</p>
      <p>
        Malheureusement nous ne pouvons pas lier ces deux types de champs actuellement. Nous vous enverrons par email un CSV contenant les IDs de la destination et les valeurs de la source pour ce champ pour que vous puissiez le mettre à jour après la migration selon les modifications souhaitées.
      </p>
    </div>
  )
}
