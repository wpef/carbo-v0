import { PlanForm } from '@/features/plans/components/plan-form'

export default function NewPlanPage() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Migration Plan</h1>
      <PlanForm />
    </main>
  )
}
