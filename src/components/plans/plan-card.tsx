'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PlanCardProps {
  plan: {
    id: string
    name: string
    description: string | null
    status: string
    currentStep: string
    createdAt: string
    updatedAt: string
  }
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'secondary',
  READY: 'default',
  BROKEN: 'destructive',
}

export function PlanCard({ plan }: PlanCardProps) {
  return (
    <Link href={`/plans/${plan.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            <Badge variant={statusVariant[plan.status] ?? 'secondary'}>{plan.status}</Badge>
          </div>
          {plan.description && (
            <CardDescription>{plan.description}</CardDescription>
          )}
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          Step: {plan.currentStep.replace(/_/g, ' ').toLowerCase()} &middot; Updated {new Date(plan.updatedAt).toLocaleDateString()}
        </CardFooter>
      </Card>
    </Link>
  )
}
