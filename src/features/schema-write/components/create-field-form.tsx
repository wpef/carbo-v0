// 022-schema-write — Create field form component (T014)
// Ported from v3 src/components/schema-write/create-field-form.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Default types shown when adapter does not provide a list
const DEFAULT_FIELD_TYPES = [
  { value: 'string', label: 'Text (string)' },
  { value: 'number', label: 'Number' },
  { value: 'bool', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'enumeration', label: 'Picklist (enumeration)' },
]

const TYPE_LABELS: Record<string, string> = {
  string: 'Text (string)',
  number: 'Number',
  bool: 'Boolean',
  date: 'Date',
  datetime: 'Date & Time',
  enumeration: 'Picklist (enumeration)',
  picklist: 'Picklist',
  phone: 'Phone',
  reference: 'Reference (lookup)',
  email: 'Email',
  url: 'URL',
  currency: 'Currency',
  int: 'Integer',
  percent: 'Percentage',
}

function labelToSnakeCase(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export interface SourceFieldOption {
  apiName: string
  label: string
  dataType: string
  description?: string
  picklistValues?: string[]
}

interface CreateFieldFormProps {
  destinationObjects: Array<{ apiName: string; label: string }>
  /** Types supported by the destination adapter — from capability.supportedFieldTypes */
  supportedFieldTypes?: string[]
  /** Source fields available for "copy from source" mode */
  sourceFields?: SourceFieldOption[]
  onSubmit: (params: {
    objectApiName: string
    name: string
    label: string
    type: string
    description?: string
    picklistValues?: string[]
    group?: string
  }) => Promise<void>
  onGenerateDescription?: (params: { fieldName: string; fieldType: string; objectApiName: string }) => Promise<string | null>
  isLoading?: boolean
}

export function CreateFieldForm({
  destinationObjects,
  supportedFieldTypes,
  sourceFields,
  onSubmit,
  onGenerateDescription,
  isLoading = false,
}: CreateFieldFormProps) {
  const [mode, setMode] = useState<'new' | 'copy'>('new')
  const [selectedSourceApiName, setSelectedSourceApiName] = useState('')

  const [objectApiName, setObjectApiName] = useState(destinationObjects[0]?.apiName ?? '')
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState('string')
  const [description, setDescription] = useState('')
  const [picklistValues, setPicklistValues] = useState('')
  const [group, setGroup] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [generatingDescription, setGeneratingDescription] = useState(false)

  // Build the type list — use adapter list if available, fallback to defaults
  const typeOptions =
    supportedFieldTypes && supportedFieldTypes.length > 0
      ? supportedFieldTypes.map((v) => ({ value: v, label: TYPE_LABELS[v] ?? v }))
      : DEFAULT_FIELD_TYPES

  function handleModeChange(newMode: 'new' | 'copy') {
    setMode(newMode)
    setSelectedSourceApiName('')
    setName('')
    setLabel('')
    setType('string')
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
    setName(labelToSnakeCase(field.label))
    // Use type if it's in the supported list, otherwise default to 'string'
    const supported = supportedFieldTypes ?? []
    const mappedType = supported.includes(field.dataType) ? field.dataType : (supported[0] ?? 'string')
    setType(mappedType)
    setDescription(field.description ?? '')
    setPicklistValues(field.picklistValues?.join('\n') ?? '')
  }

  async function handleGenerateDescription() {
    if (!onGenerateDescription) return
    setGeneratingDescription(true)
    try {
      const result = await onGenerateDescription({ fieldName: name || label, fieldType: type, objectApiName })
      if (result) setDescription(result)
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
    if (!name.trim()) {
      setValidationError("Le nom d'API est requis.")
      return
    }
    if (!label.trim()) {
      setValidationError('Le libellé est requis.')
      return
    }
    if (!type.trim()) {
      setValidationError('Le type de données est requis.')
      return
    }

    const parsedPicklistValues =
      ['enumeration', 'picklist'].includes(type) && picklistValues.trim()
        ? picklistValues.split('\n').map((v) => v.trim()).filter(Boolean)
        : undefined

    await onSubmit({
      objectApiName: objectApiName.trim(),
      name: name.trim(),
      label: label.trim(),
      type: type.trim(),
      description: description.trim() || undefined,
      picklistValues: parsedPicklistValues,
      group: group.trim() || undefined,
    })

    // Reset on success
    setName('')
    setLabel('')
    setType('string')
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
            mode === 'new' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Nouveau champ
        </button>
        {sourceFields && sourceFields.length > 0 && (
          <button
            type="button"
            onClick={() => handleModeChange('copy')}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              mode === 'copy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
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
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">— Sélectionner un champ —</option>
            {sourceFields.map((f) => (
              <option key={f.apiName} value={f.apiName}>
                {f.label} ({f.apiName})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Les valeurs seront pré-remplies à partir du champ sélectionné.</p>
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
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {destinationObjects.length === 0 && <option value="">Aucun objet disponible</option>}
          {destinationObjects.map((obj) => (
            <option key={obj.apiName} value={obj.apiName}>
              {obj.label} ({obj.apiName})
            </option>
          ))}
        </select>
      </div>

      {/* API Name */}
      <div className="space-y-1">
        <label htmlFor="field-api-name" className="text-sm font-medium">
          Nom d&apos;API <span className="text-destructive">*</span>
        </label>
        <Input
          id="field-api-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. champ_personnalise"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">L&apos;identifiant technique de ce champ.</p>
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
        <label htmlFor="field-type" className="text-sm font-medium">
          Type de données <span className="text-destructive">*</span>
        </label>
        <select
          id="field-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={isLoading}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {typeOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Picklist values */}
      {['enumeration', 'picklist'].includes(type) && (
        <div className="space-y-1">
          <label htmlFor="field-picklist" className="text-sm font-medium">
            Valeurs de liste <span className="text-destructive">*</span>
          </label>
          <textarea
            id="field-picklist"
            value={picklistValues}
            onChange={(e) => setPicklistValues(e.target.value)}
            placeholder={"Valeur 1\nValeur 2\nValeur 3"}
            disabled={isLoading}
            rows={4}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-y"
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
              disabled={isLoading || generatingDescription || !name.trim()}
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
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-y"
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

      {validationError && <p className="text-sm text-destructive">{validationError}</p>}

      <Button type="submit" disabled={isLoading || !objectApiName || !name.trim() || !label.trim()}>
        {isLoading ? 'Création...' : 'Créer le champ'}
      </Button>
    </form>
  )
}
