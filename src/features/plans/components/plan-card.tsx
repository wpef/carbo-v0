'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { STEP_LABELS } from '../lib/steps'
import type { PlanListItem } from '../types'

export function PlanCard({ plan }: { plan: PlanListItem }) {
  return (
    <Link href={`/plans/${plan.id}`}>
      <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{plan.name}</h3>
            {plan.description && (
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
            )}
          </div>
          <Badge variant={plan.status === 'DRAFT' ? 'secondary' : 'default'}>
            {plan.status}
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Step: {STEP_LABELS[plan.currentStep]}</span>
          <span>Updated: {new Date(plan.updatedAt).toLocaleDateString()}</span>
        </div>
      </Card>
    </Link>
  )
}
