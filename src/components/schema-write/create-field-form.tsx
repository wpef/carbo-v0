// 022-schema-write — Create field form component

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Common field data types supported by destination systems
const FIELD_DATA_TYPES = [
  { value: 'string', label: 'Text (string)' },
  { value: 'number', label: 'Number' },
  { value: 'bool', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'enumeration', label: 'Picklist (enumeration)' },
  { value: 'phone', label: 'Phone' },
  { value: 'reference', label: 'Reference (lookup)' },
]

function labelToSnakeCase(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

interface DestinationObject {
  apiName: string
  label: string
}

interface SourceFieldOption {
  apiName: string
  label: string
  dataType: string
  description?: string
  picklistValues?: string[]
}

interface CreateFieldFormProps {
  destinationObjects: DestinationObject[]
  sourceFields?: SourceFieldOption[]
  onSubmit: (params: {
    objectApiName: string
    apiName: string
    label: string
    dataType: string
    isRequired: boolean
    description?: string
    picklistValues?: string[]
    group?: string
  }) => Promise<void>
  onGenerateDescription?: () => Promise<string>
  isLoading?: boolean
}

export function CreateFieldForm({
  destinationObjects,
  sourceFields,
  onSubmit,
  onGenerateDescription,
  isLoading = false,
}: CreateFieldFormProps) {
  const [mode, setMode] = useState<'new' | 'copy'>('new')
  const [selectedSourceApiName, setSelectedSourceApiName] = useState('')

  const [objectApiName, setObjectApiName] = useState(destinationObjects[0]?.apiName ?? '')
  const [apiName, setApiName] = useState('')
  const [label, setLabel] = useState('')
  const [dataType, setDataType] = useState('string')
  const [isRequired, setIsRequired] = useState(false)
  const [description, setDescription] = useState('')
  const [picklistValues, setPicklistValues] = useState('')
  const [group, setGroup] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  function handleModeChange(newMode: 'new' | 'copy') {
    setMode(newMode)
    setSelectedSourceApiName('')
    setApiName('')
    setLabel('')
    setDataType('string')
    setDescription('')
    setPicklistValues('')
    setGroup('')
    setValidationError(null)
  }

  function handleSourceFieldSelect(sourceApiName: string) {
    setSelectedSourceApiName(sourceApiName)
    if (!sourceApiName) return

    const field = sourceFields?.find((f) => f.apiName === sourceApiName)
    if (!field) return

    setLabel(field.label)
    setApiName(labelToSnakeCase(field.label))
    setDataType(field.dataType)
    setDescription(field.description ?? '')
    setPicklistValues(field.picklistValues?.join('\n') ?? '')
  }

  async function handleGenerateDescription() {
    if (!onGenerateDescription) return
    setGeneratingDescription(true)
    try {
      const result = await onGenerateDescription()
      setDescription(result)
    } finally {
      setGeneratingDescription(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!objectApiName.trim()) {
      setValidationError('Veuillez sélectionner un objet de destination.')
      return
    }
    if (!apiName.trim()) {
      setValidationError("Le nom d'API est requis.")
      return
    }
    if (!label.trim()) {
      setValidationError('Le libellé est requis.')
      return
    }
    if (!dataType.trim()) {
      setValidationError('Le type de données est requis.')
      return
    }

    const parsedPicklistValues =
      dataType === 'enumeration' && picklistValues.trim()
        ? picklistValues
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined

    await onSubmit({
      objectApiName: objectApiName.trim(),
      apiName: apiName.trim(),
      label: label.trim(),
      dataType: dataType.trim(),
      isRequired,
      description: description.trim() || undefined,
      picklistValues: parsedPicklistValues,
      group: group.trim() || undefined,
    })

    setApiName('')
    setLabel('')
    setDataType('string')
    setIsRequired(false)
    setDescription('')
    setPicklistValues('')
    setGroup('')
    setSelectedSourceApiName('')
    setMode('new')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          type="button"
          onClick={() => handleModeChange('new')}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            mode === 'new'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Nouveau champ
        </button>
        {sourceFields && sourceFields.length > 0 && (
          <button
            type="button"
            onClick={() => handleModeChange('copy')}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'copy'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Copier depuis la source
          </button>
        )}
      </div>

      {/* Source field picker */}
      {mode === 'copy' && sourceFields && (
        <div className="space-y-1">
          <label htmlFor="source-field-select" className="text-sm font-medium">
            Champ source
          </label>
          <select
            id="source-field-select"
            value={selectedSourceApiName}
            onChange={(e) => handleSourceFieldSelect(e.target.value)}
            disabled={isLoading}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— Sélectionner un champ —</option>
            {sourceFields.map((f) => (
              <option key={f.apiName} value={f.apiName}>
                {f.label} ({f.apiName})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Les valeurs seront pré-remplies à partir du champ sélectionné.
          </p>
        </div>
      )}

      {/* Destination object */}
      <div className="space-y-1">
        <label htmlFor="field-object" className="text-sm font-medium">
          Objet de destination <span className="text-destructive">*</span>
        </label>
        <select
          id="field-object"
          value={objectApiName}
          onChange={(e) => setObjectApiName(e.target.value)}
          disabled={isLoading}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {destinationObjects.length === 0 && (
            <option value="">Aucun objet disponible</option>
          )}
          {destinationObjects.map((obj) => (
            <option key={obj.apiName} value={obj.apiName}>
              {obj.label} ({obj.apiName})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          L&apos;objet dans lequel ce champ sera ajouté.
        </p>
      </div>

      {/* API Name */}
      <div className="space-y-1">
        <label htmlFor="field-api-name" className="text-sm font-medium">
          Nom d&apos;API <span className="text-destructive">*</span>
        </label>
        <Input
          id="field-api-name"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          placeholder="ex. custom_field__c"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          L&apos;identifiant technique de ce champ.
        </p>
      </div>

      {/* Label */}
      <div className="space-y-1">
        <label htmlFor="field-label" className="text-sm font-medium">
          Libellé <span className="text-destructive">*</span>
        </label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex. Champ personnalisé"
          disabled={isLoading}
        />
      </div>

      {/* Data type */}
      <div className="space-y-1">
        <label htmlFor="field-data-type" className="text-sm font-medium">
          Type de données <span className="text-destructive">*</span>
        </label>
        <select
          id="field-data-type"
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          disabled={isLoading}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {FIELD_DATA_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Picklist values — only for enumeration */}
      {dataType === 'enumeration' && (
        <div className="space-y-1">
          <label htmlFor="field-picklist" className="text-sm font-medium">
            Valeurs de liste
          </label>
          <textarea
            id="field-picklist"
            value={picklistValues}
            onChange={(e) => setPicklistValues(e.target.value)}
            placeholder={"Valeur 1\nValeur 2\nValeur 3"}
            disabled={isLoading}
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
          <p className="text-xs text-muted-foreground">Une valeur par ligne.</p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="field-description" className="text-sm font-medium">
            Description
          </label>
          {onGenerateDescription && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleGenerateDescription}
              disabled={isLoading || generatingDescription}
              className="h-6 px-2 text-xs"
            >
              {generatingDescription ? 'Génération...' : 'Générer la description'}
            </Button>
          )}
        </div>
        <textarea
          id="field-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle de ce champ"
          disabled={isLoading}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-y"
        />
      </div>

      {/* Group */}
      <div className="space-y-1">
        <label htmlFor="field-group" className="text-sm font-medium">
          Groupe
        </label>
        <Input
          id="field-group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="Property group"
          disabled={isLoading}
        />
      </div>

      {/* Required checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="field-required"
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor="field-required" className="text-sm font-medium">
          Champ obligatoire
        </label>
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      <Button
        type="submit"
        disabled={isLoading || !objectApiName || !apiName.trim() || !label.trim()}
      >
        {isLoading ? 'Création...' : 'Créer le champ'}
      </Button>
    </form>
  )
}
