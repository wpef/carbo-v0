'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlanCard } from './plan-card'
import type { PlanListItem } from '../types'

export function PlanList() {
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadPlans = useCallback(() => {
    fetch('/api/plans')
      .then((r) => r.json())
      .then((data: unknown) => {
        // Spec: GET /api/plans returns an array directly (not { plans: [...] })
        const arr = Array.isArray(data) ? data : []
        setPlans(arr as PlanListItem[])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  function handleDeleted(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId))
  }

  if (loading) {
    return <div className="text-muted-foreground">Chargement des plans…</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Plans de migration</h1>
        <Link href="/plans/new">
          <Button>Nouveau plan</Button>
        </Link>
      </div>
      {plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Aucun plan de migration.</p>
          <p className="mt-2">Créez votre premier plan pour commencer.</p>
          <Link href="/plans/new" className="mt-4 inline-block">
            <Button>Créer un plan</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDeleted={() => handleDeleted(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
