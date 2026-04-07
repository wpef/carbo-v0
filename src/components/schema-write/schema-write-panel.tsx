// 022-schema-write — Schema write panel component

'use client'

import { useState, useEffect } from 'react'
import { CreateObjectForm } from './create-object-form'
import { CreateFieldForm } from './create-field-form'
import { ModifyFieldModal } from './modify-field-modal'
import { useSchemaWrite } from '@/hooks/use-schema-write'
import type { ConnectorField } from '@/lib/connectors/types'

interface SourceFieldOption {
  apiName: string
  label: string
  dataType: string
  description?: string
  picklistValues?: string[]
}

interface SchemaWritePanelProps {
  planId: string
  destinationObjects?: Array<{ apiName: string; label: string }>
  destinationFields?: ConnectorField[]
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

  const {
    capability,
    capabilityLoading,
    creating,
    error,
    fetchCapability,
    createObject,
    createField,
    clearError,
  } = useSchemaWrite(planId)

  useEffect(() => {
    fetchCapability()
  }, [fetchCapability])

  async function handleCreateObject(apiName: string, label: string) {
    setSuccessMessage(null)
    clearError()
    const result = await createObject(apiName, label)
    if (result) {
      setSuccessMessage(`Objet "${result.label}" (${result.apiName}) créé avec succès.`)
      onSchemaChanged?.()
    }
  }

  async function handleCreateField(params: {
    objectApiName: string
    apiName: string
    label: string
    dataType: string
    isRequired: boolean
    description?: string
    picklistValues?: string[]
    group?: string
  }) {
    setSuccessMessage(null)
    clearError()
    const result = await createField(params)
    if (result) {
      setSuccessMessage(`Champ "${result.label}" (${result.apiName}) créé avec succès dans ${params.objectApiName}.`)
      onSchemaChanged?.()
    }
  }

  const selectedField = destinationFields.find((f) => f.apiName === selectedFieldApiName)

  function handleFieldPickerChange(apiName: string) {
    setSelectedFieldApiName(apiName)
    if (apiName) {
      setModifyModalOpen(true)
    }
  }

  async function handleModifyFieldSave(updates: {
    label: string
    dataType: string
    description?: string
    picklistValues?: string[]
    group?: string
  }) {
    setModifySaving(true)
    try {
      // API route for field modification not yet implemented — log for now
      console.log('Modify field:', selectedFieldApiName, updates)
      setModifyModalOpen(false)
      setSelectedFieldApiName('')
      setSuccessMessage(`Champ "${updates.label}" modifié (aperçu — la sauvegarde réelle n'est pas encore disponible).`)
    } finally {
      setModifySaving(false)
    }
  }

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
          L&apos;adaptateur <span className="font-medium">{capability.adapterType}</span> ne prend pas en charge
          la création d&apos;objets ou de champs dans le système de destination. Effectuez les modifications de schéma
          dans l&apos;interface native du système de destination, puis actualisez le schéma de destination.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab('field')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'field'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Ajouter un champ
        </button>
        <button
          onClick={() => setActiveTab('object')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'object'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Ajouter un objet
        </button>
        <button
          onClick={() => setActiveTab('modify')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'modify'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Modifier un champ
        </button>
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
              sourceFields={sourceFields}
              onSubmit={handleCreateField}
              isLoading={creating}
            />
          </>
        )}

        {activeTab === 'object' && (
          <>
            <h3 className="text-sm font-semibold mb-4">Créer un nouvel objet de destination</h3>
            <CreateObjectForm onSubmit={handleCreateObject} isLoading={creating} />
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
                <p className="text-xs text-muted-foreground">
                  Cliquez sur un champ pour ouvrir le formulaire de modification.
                </p>
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
          onSave={handleModifyFieldSave}
          saving={modifySaving}
        />
      )}
    </div>
  )
}
