// 022-schema-write — Create object form component (T016)
// Ported from v3 src/components/schema-write/create-object-form.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PRIMARY_PROP_TYPES = [
  { value: 'string', label: 'Text (string)' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
]

interface CreateObjectFormProps {
  onSubmit: (params: {
    name: string
    label: string
    description?: string
    primaryProperty: { name: string; label: string; type: string }
  }) => Promise<void>
  isLoading?: boolean
}

export function CreateObjectForm({ onSubmit, isLoading = false }: CreateObjectFormProps) {
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [primaryName, setPrimaryName] = useState('')
  const [primaryLabel, setPrimaryLabel] = useState('')
  const [primaryType, setPrimaryType] = useState('string')
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!name.trim()) {
      setValidationError("Le nom d'API de l'objet est requis.")
      return
    }
    if (!label.trim()) {
      setValidationError("Le libellé de l'objet est requis.")
      return
    }
    if (!primaryName.trim()) {
      setValidationError('Le nom de la propriété principale est requis.')
      return
    }
    if (!primaryLabel.trim()) {
      setValidationError('Le libellé de la propriété principale est requis.')
      return
    }

    await onSubmit({
      name: name.trim(),
      label: label.trim(),
      description: description.trim() || undefined,
      primaryProperty: {
        name: primaryName.trim(),
        label: primaryLabel.trim(),
        type: primaryType,
      },
    })

    setName('')
    setLabel('')
    setDescription('')
    setPrimaryName('')
    setPrimaryLabel('')
    setPrimaryType('string')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="object-api-name" className="text-sm font-medium">
          Nom d&apos;API <span className="text-destructive">*</span>
        </label>
        <Input
          id="object-api-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. projects__c"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">L&apos;identifiant technique utilisé par le système de destination.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="object-label" className="text-sm font-medium">
          Libellé <span className="text-destructive">*</span>
        </label>
        <Input
          id="object-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex. Projets"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">Le nom affiché dans l&apos;interface du système de destination.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="object-description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="object-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description optionnelle"
          disabled={isLoading}
        />
      </div>

      {/* Primary property */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-sm font-semibold">Propriété principale</p>
        <p className="text-xs text-muted-foreground">Champ primaire requis pour les objets personnalisés.</p>

        <div className="space-y-1">
          <label htmlFor="primary-prop-name" className="text-sm font-medium">
            Nom d&apos;API <span className="text-destructive">*</span>
          </label>
          <Input
            id="primary-prop-name"
            value={primaryName}
            onChange={(e) => setPrimaryName(e.target.value)}
            placeholder="ex. project_name"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="primary-prop-label" className="text-sm font-medium">
            Libellé <span className="text-destructive">*</span>
          </label>
          <Input
            id="primary-prop-label"
            value={primaryLabel}
            onChange={(e) => setPrimaryLabel(e.target.value)}
            placeholder="ex. Nom du projet"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="primary-prop-type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="primary-prop-type"
            value={primaryType}
            onChange={(e) => setPrimaryType(e.target.value)}
            disabled={isLoading}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {PRIMARY_PROP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {validationError && <p className="text-sm text-destructive">{validationError}</p>}

      <Button type="submit" disabled={isLoading || !name.trim() || !label.trim()}>
        {isLoading ? 'Création...' : "Créer l'objet"}
      </Button>
    </form>
  )
}
