import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlanForm } from "@/features/plans/components/plan-form";

export default function NewPlanPage() {
  return (
    <main className="mx-auto w-full max-w-lg p-8">
      <Link
        href="/"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Retour aux plans
      </Link>
      <h1 className="mb-6 text-2xl font-semibold">Nouveau plan de migration</h1>
      <PlanForm />
    </main>
  );
}
