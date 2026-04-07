'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { StepWorkflow } from '@/components/plans/step-workflow'
import { DeletePlanDialog } from '@/components/plans/delete-plan-dialog'
import { Badge } from '@/components/ui/badge'
import { normalizeStep } from '@/lib/types/plan'

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

const STEP_CONFIG: Record<string, { description: string; href: (planId: string) => string; label: string }> = {
  SOURCE: {
    description: 'Connect to your source system. Schema, objects, and fields are retrieved automatically.',
    href: (id) => `/plans/${id}/source`,
    label: 'Configure Source',
  },
  DESTINATION: {
    description: 'Connect to the destination system. Schema and fields are retrieved automatically.',
    href: (id) => `/plans/${id}/destination`,
    label: 'Configure Destination',
  },
  MAPPING: {
    description: 'Link source objects to destination objects.',
    href: (id) => `/plans/${id}/mapping`,
    label: 'Object Mapping',
  },
  FIELD_MAPPING: {
    description: 'Map fields, configure filters and transformation rules for each object pair.',
    href: (id) => `/plans/${id}/field-mapping`,
    label: 'Field Mapping',
  },
  DOCUMENTS: {
    description: 'Generate client validation documents.',
    href: (id) => `/plans/${id}/documents`,
    label: 'Generate Documents',
  },
}

function StepAction({ planId, currentStep }: { planId: string; currentStep: string }) {
  const normalized = normalizeStep(currentStep)
  const config = STEP_CONFIG[normalized]

  if (!config) {
    return <p className="text-muted-foreground text-sm">{currentStep.replace(/_/g, ' ').toLowerCase()}</p>
  }

  return (
    <div>
      <p className="text-muted-foreground text-sm mb-4">{config.description}</p>
      <Link
        href={config.href(planId)}
        className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        {config.label} &rarr;
      </Link>
    </div>
  )
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
          <StepWorkflow planId={plan.id} currentStep={plan.currentStep} />
        </aside>
        <section>
          <h2 className="text-sm font-medium mb-4">Current Step</h2>
          <StepAction planId={plan.id} currentStep={plan.currentStep} />
        </section>
      </div>
    </main>
  )
}
