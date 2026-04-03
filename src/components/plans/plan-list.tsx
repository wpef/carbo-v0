'use client'

import { useEffect, useState } from 'react'
import { PlanCard } from './plan-card'

interface Plan {
  id: string
  name: string
  description: string | null
  status: string
  currentStep: string
  createdAt: string
  updatedAt: string
}

export function PlanList() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => setPlans(data.plans))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading plans...</p>
  if (plans.length === 0) return <p className="text-muted-foreground">No plans yet. Create your first migration plan.</p>

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  )
}
