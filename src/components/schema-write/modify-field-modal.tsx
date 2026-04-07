// 022-schema-write — Modify destination field modal

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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

interface ModifyFieldModalProps {
  open: boolean
  onClose: () => void
  field: {
    apiName: string
    label: string
    dataType: string
    description?: string
    picklistValues?: string[]
    group?: string
  }
  onSave: (updates: {
    label: string
    dataType: string
    description?: string
    picklistValues?: string[]
    group?: string
  }) => Promise<void>
  onGenerateDescription?: () => Promise<string>
  saving?: boolean
}

export function ModifyFieldModal({
  open,
  onClose,
  field,
  onSave,
  onGenerateDescription,
  saving = false,
}: ModifyFieldModalProps) {
  const [label, setLabel] = useState(field.label)
  const [dataType, setDataType] = useState(field.dataType)
  const [description, setDescription] = useState(field.description ?? '')
  const [picklistValues, setPicklistValues] = useState(
    field.picklistValues?.join('\n') ?? ''
  )
  const [group, setGroup] = useState(field.group ?? '')
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Reset form when field changes
  useEffect(() => {
    setLabel(field.label)
    setDataType(field.dataType)
    setDescription(field.description ?? '')
    setPicklistValues(field.picklistValues?.join('\n') ?? '')
    setGroup(field.group ?? '')
    setValidationError(null)
  }, [field])

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

  async function handleSave() {
    setValidationError(null)

    if (!label.trim()) {
      setValidationError('Le libellé est requis.')
      return
    }

    const parsedPicklistValues =
      dataType === 'enumeration' && picklistValues.trim()
        ? picklistValues
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined

    await onSave({
      label: label.trim(),
      dataType,
      description: description.trim() || undefined,
      picklistValues: parsedPicklistValues,
      group: group.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            Modifier le champ{' '}
            <span className="font-mono text-muted-foreground">{field.apiName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Label */}
          <div className="space-y-1">
            <label htmlFor="modify-field-label" className="text-sm font-medium">
              Libellé <span className="text-destructive">*</span>
            </label>
            <Input
              id="modify-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Data type */}
          <div className="space-y-1">
            <label htmlFor="modify-field-data-type" className="text-sm font-medium">
              Type de données
            </label>
            <select
              id="modify-field-data-type"
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              disabled={saving}
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
              <label htmlFor="modify-field-picklist" className="text-sm font-medium">
                Valeurs de liste
              </label>
              <textarea
                id="modify-field-picklist"
                value={picklistValues}
                onChange={(e) => setPicklistValues(e.target.value)}
                placeholder={"Valeur 1\nValeur 2\nValeur 3"}
                disabled={saving}
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              />
              <p className="text-xs text-muted-foreground">Une valeur par ligne.</p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="modify-field-description" className="text-sm font-medium">
                Description
              </label>
              {onGenerateDescription && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={saving || generatingDescription}
                  className="h-6 px-2 text-xs"
                >
                  {generatingDescription ? 'Génération...' : 'Générer la description'}
                </Button>
              )}
            </div>
            <textarea
              id="modify-field-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle de ce champ"
              disabled={saving}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            />
          </div>

          {/* Group */}
          <div className="space-y-1">
            <label htmlFor="modify-field-group" className="text-sm font-medium">
              Groupe
            </label>
            <Input
              id="modify-field-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Property group"
              disabled={saving}
            />
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !label.trim()}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
