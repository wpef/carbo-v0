import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PlanList } from "@/features/plans/components/plan-list";
import { listPlans } from "@/features/plans/services/plan-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPlans();
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plans de migration</h1>
        <Link href="/plans/new" className={buttonVariants()}>
          Nouveau plan
        </Link>
      </div>
      <PlanList plans={plans} />
    </main>
  );
}
