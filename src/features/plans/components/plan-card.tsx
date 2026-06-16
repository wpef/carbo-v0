'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { STEP_LABELS } from '../lib/steps'
import { DeletePlanDialog } from './delete-plan-dialog'
import type { PlanListItem } from '../types'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Brouillon', variant: 'secondary' },
  READY: { label: 'Prêt', variant: 'default' },
  BROKEN: { label: 'Erreur', variant: 'destructive' },
}

interface PlanCardProps {
  plan: PlanListItem
  onDeleted?: () => void
}

export function PlanCard({ plan, onDeleted }: PlanCardProps) {
  const statusCfg = STATUS_CONFIG[plan.status] ?? STATUS_CONFIG.DRAFT
  return (
    <Card className="hover:ring-primary/50 transition-all">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/plans/${plan.id}`} className="flex-1 min-w-0">
            <CardTitle className="truncate hover:text-primary transition-colors">
              {plan.name}
            </CardTitle>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            <DeletePlanDialog
              planId={plan.id}
              planName={plan.name}
              compact
              onDeleted={onDeleted}
            />
          </div>
        </div>
        {plan.description && (
          <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
        )}
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground gap-4">
        <span>Étape : {STEP_LABELS[plan.currentStep]}</span>
        <span>Mis à jour le {new Date(plan.updatedAt).toLocaleDateString('fr-FR')}</span>
      </CardFooter>
    </Card>
  )
}
