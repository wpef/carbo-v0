import { PlanList } from '@/components/plans/plan-list'
import { CreatePlanDialog } from '@/components/plans/create-plan-dialog'

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Migration Plans</h1>
          <p className="text-muted-foreground">Manage your data migration projects</p>
        </div>
        <CreatePlanDialog />
      </div>
      <PlanList />
    </main>
  )
}
