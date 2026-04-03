'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { StepWorkflow } from '@/components/plans/step-workflow'
import { DeletePlanDialog } from '@/components/plans/delete-plan-dialog'
import { Badge } from '@/components/ui/badge'

interface Plan {
  id: string
  name: string
  description: string | null
  status: string
  currentStep: string
  sourceConnectionId: string | null
  destinationConnectionId: string | null
  createdAt: string
  updatedAt: string
}

export default function PlanDetailPage() {
  const params = useParams<{ planId: string }>()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/plans/${params.planId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Plan not found')
        return res.json()
      })
      .then(setPlan)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.planId])

  if (loading) return <main className="max-w-5xl mx-auto p-8"><p className="text-muted-foreground">Loading...</p></main>
  if (error || !plan) return <main className="max-w-5xl mx-auto p-8"><p className="text-destructive">{error || 'Plan not found'}</p></main>

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">&larr; Back to plans</Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{plan.name}</h1>
            <Badge variant={plan.status === 'BROKEN' ? 'destructive' : 'secondary'}>{plan.status}</Badge>
          </div>
          {plan.description && <p className="text-muted-foreground">{plan.description}</p>}
          <p className="text-xs text-muted-foreground mt-2">Created {new Date(plan.createdAt).toLocaleDateString()}</p>
        </div>
        <DeletePlanDialog planId={plan.id} planName={plan.name} />
      </div>

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside>
          <h2 className="text-sm font-medium mb-4">Workflow</h2>
          <StepWorkflow currentStep={plan.currentStep} />
        </aside>
        <section>
          <h2 className="text-sm font-medium mb-4">Current Step</h2>
          <p className="text-muted-foreground">
            {plan.currentStep.replace(/_/g, ' ').toLowerCase()} — configure this step to proceed.
          </p>
        </section>
      </div>
    </main>
  )
}
