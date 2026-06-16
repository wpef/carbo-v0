// 022-schema-write — Schema write panel (T014-T017)
// Orchestrates createField / createObject / modifyField UI.
// Ported from v3 src/components/schema-write/schema-write-panel.tsx.

'use client'

import { useState, useEffect } from 'react'
import { CreateObjectForm } from './create-object-form'
import { CreateFieldForm, type SourceFieldOption } from './create-field-form'
import { ModifyFieldModal, type ModifyableField } from './modify-field-modal'
import { useSchemaWrite } from '@/features/schema-write/hooks/use-schema-write'

interface SchemaWritePanelProps {
  planId: string
  destinationObjects?: Array<{ apiName: string; label: string }>
  destinationFields?: ModifyableField[]
  sourceFields?: SourceFieldOption[]
  onSchemaChanged?: () => void
}

export function SchemaWritePanel({
  planId,
  destinationObjects = [],
  destinationFields = [],
  sourceFields,
  onSchemaChanged,
}: SchemaWritePanelProps) {
  const [activeTab, setActiveTab] = useState<'field' | 'object' | 'modify'>('field')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modify field state
  const [selectedFieldApiName, setSelectedFieldApiName] = useState('')
  const [modifyModalOpen, setModifyModalOpen] = useState(false)
  const [modifySaving, setModifySaving] = useState(false)
  const [modifyObjectApiName, setModifyObjectApiName] = useState('')

  const {
    capability,
    capabilityLoading,
    mutating,
    error,
    fetchCapability,
    createField,
    modifyField,
    createObject,
    generateDescription,
    clearError,
  } = useSchemaWrite(planId)

  useEffect(() => {
    fetchCapability()
  }, [fetchCapability])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCreateField(params: {
    objectApiName: string
    name: string
    label: string
    type: string
    description?: string
    picklistValues?: string[]
    group?: string
  }) {
    setSuccessMessage(null)
    clearError()
    const result = await createField(params)
    if (result) {
      setSuccessMessage(`Champ "${result.field.label}" (${result.field.apiName}) créé avec succès dans ${params.objectApiName}.`)
      onSchemaChanged?.()
    }
  }

  async function handleCreateObject(params: {
    name: string
    label: string
    description?: string
    primaryProperty: { name: string; label: string; type: string }
  }) {
    setSuccessMessage(null)
    clearError()
    const result = await createObject(params)
    if (result) {
      setSuccessMessage(`Objet "${result.object.label}" (${result.object.apiName}) créé avec succès.`)
      onSchemaChanged?.()
    }
  }

  function handleFieldPickerChange(apiName: string, objectApiName?: string) {
    setSelectedFieldApiName(apiName)
    setModifyObjectApiName(objectApiName ?? '')
    if (apiName) setModifyModalOpen(true)
  }

  async function handleModifyFieldSave(updates: {
    label?: string
    type?: string
    description?: string
    picklistValues?: string[]
    group?: string
  }) {
    if (!selectedFieldApiName) return
    setModifySaving(true)
    try {
      const result = await modifyField(modifyObjectApiName, selectedFieldApiName, updates)
      if (result) {
        setModifyModalOpen(false)
        setSelectedFieldApiName('')
        setSuccessMessage(`Champ "${result.field.label}" modifié avec succès.`)
        onSchemaChanged?.()
      }
    } finally {
      setModifySaving(false)
    }
  }

  async function handleGenerateDescription(params: { fieldName: string; fieldType: string; objectApiName: string }) {
    return generateDescription({
      objectApiName: params.objectApiName,
      objectLabel: params.objectApiName,
      fieldName: params.fieldName,
      fieldType: params.fieldType,
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (capabilityLoading) {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">Vérification de la capacité d&apos;écriture du schéma…</p>
      </div>
    )
  }

  if (!capability) {
    return (
      <div className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">
          Impossible de déterminer la capacité d&apos;écriture du schéma. Vérifiez qu&apos;une connexion de destination est configurée.
        </p>
      </div>
    )
  }

  if (!capability.canWriteSchema) {
    return (
      <div className="rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold mb-2">Écriture de schéma indisponible</h3>
        <p className="text-sm text-muted-foreground">
          Le connecteur de destination ne prend pas en charge la création d&apos;objets ou de champs.
          Effectuez les modifications dans l&apos;interface native du système de destination, puis actualisez le schéma.
        </p>
      </div>
    )
  }

  const selectedField = destinationFields.find((f) => f.apiName === selectedFieldApiName)

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        {(['field', 'object', 'modify'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'field' ? 'Ajouter un champ' : tab === 'object' ? 'Ajouter un objet' : 'Modifier un champ'}
          </button>
        ))}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Active form */}
      <div className="rounded-lg border border-border p-6">
        {activeTab === 'field' && (
          <>
            <h3 className="text-sm font-semibold mb-4">Ajouter un champ à un objet de destination</h3>
            <CreateFieldForm
              destinationObjects={destinationObjects}
              supportedFieldTypes={capability.supportedFieldTypes}
              sourceFields={sourceFields}
              onSubmit={handleCreateField}
              onGenerateDescription={handleGenerateDescription}
              isLoading={mutating}
            />
          </>
        )}

        {activeTab === 'object' && (
          <>
            <h3 className="text-sm font-semibold mb-4">Créer un nouvel objet de destination</h3>
            <CreateObjectForm onSubmit={handleCreateObject} isLoading={mutating} />
          </>
        )}

        {activeTab === 'modify' && (
          <>
            <h3 className="text-sm font-semibold mb-4">Modifier un champ de destination</h3>
            {destinationFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun champ de destination disponible. Chargez d&apos;abord le schéma de destination.
              </p>
            ) : (
              <div className="space-y-2">
                <label htmlFor="modify-field-picker" className="text-sm font-medium">
                  Sélectionner un champ
                </label>
                <select
                  id="modify-field-picker"
                  value={selectedFieldApiName}
                  onChange={(e) => handleFieldPickerChange(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">— Sélectionner un champ —</option>
                  {destinationFields.map((f) => (
                    <option key={f.apiName} value={f.apiName}>
                      {f.label} ({f.apiName})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Sélectionnez un champ pour ouvrir le formulaire de modification.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modify field modal */}
      {selectedField && (
        <ModifyFieldModal
          open={modifyModalOpen}
          onClose={() => {
            setModifyModalOpen(false)
            setSelectedFieldApiName('')
          }}
          field={selectedField}
          supportedFieldTypes={capability.supportedFieldTypes}
          onSave={handleModifyFieldSave}
          onGenerateDescription={handleGenerateDescription}
          objectApiName={modifyObjectApiName}
          saving={modifySaving}
        />
      )}
    </div>
  )
}
