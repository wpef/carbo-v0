'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlanCard } from './plan-card'
import type { PlanListItem } from '../types'

export function PlanList() {
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/plans')
      .then((r) => r.json())
      .then((data) => setPlans(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-muted-foreground">Loading plans...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Migration Plans</h1>
        <Link href="/plans/new">
          <Button>New Plan</Button>
        </Link>
      </div>
      {plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No migration plans yet.</p>
          <p className="mt-2">Create your first plan to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  )
}
