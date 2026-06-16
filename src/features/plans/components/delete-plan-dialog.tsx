'use client'

// FR-003: delete plan with confirmation dialog (cascade-deletes all associated data).
// Uses AlertDialog from @base-ui via src/components/ui/alert-dialog.tsx.
// Redirects to home after successful delete.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

interface DeletePlanDialogProps {
  planId: string
  planName: string
  /** Called after successful delete (optional — layout usually handles redirect) */
  onDeleted?: () => void
  /** When true the trigger renders as a small button suitable for card/list context */
  compact?: boolean
}

export function DeletePlanDialog({ planId, planName, onDeleted, compact }: DeletePlanDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        onDeleted?.()
        router.push('/')
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Erreur lors de la suppression.')
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size={compact ? 'sm' : 'default'}
          />
        }
      >
        Supprimer
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le plan</AlertDialogTitle>
          <AlertDialogDescription>
            Êtes-vous sûr de vouloir supprimer &quot;{planName}&quot; ?
            Cette action supprime définitivement le plan et toutes les données associées
            (connexions, schémas, mappings, documents). Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive px-4">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
